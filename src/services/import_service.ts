/*
|--------------------------------------------------------------------------
| ImportService
|--------------------------------------------------------------------------
|
| Orchestrates the full import lifecycle: adapter resolution, status
| transitions, batched extraction, record persistence, and resumability.
|
| Both the admin UI controller and the CLI command (`escalated:import`)
| call this service. An optional `onProgress` callback is called after
| each batch so callers can stream progress to the terminal or push a
| real-time UI update.
|
*/

import { DateTime } from 'luxon'
import { string } from '@adonisjs/core/helpers'
import ImportJob from '../models/import_job.js'
import ImportSourceMap from '../models/import_source_map.js'
import ImportContext from '../support/import_context.js'
import type { ImportAdapter } from '../contracts/import_adapter.js'
import type { TicketStatus, TicketPriority } from '../types.js'
import { escalated_applyFilters, escalated_doAction } from '../support/helpers.js'

export default class ImportService {
  // --------------------------------------------------------------------------
  // Adapter registry
  // --------------------------------------------------------------------------

  /**
   * Resolve all registered import adapters via the `import.adapters` filter.
   * Plugins add their adapters by hooking this filter.
   */
  async availableAdapters(): Promise<ImportAdapter[]> {
    return escalated_applyFilters('import.adapters', [] as ImportAdapter[])
  }

  /**
   * Find the adapter registered for a specific platform slug.
   */
  async resolveAdapter(platform: string): Promise<ImportAdapter | null> {
    const adapters = await this.availableAdapters()
    return adapters.find((a) => a.name() === platform) ?? null
  }

  // --------------------------------------------------------------------------
  // Connection test
  // --------------------------------------------------------------------------

  async testConnection(job: ImportJob): Promise<boolean> {
    const adapter = await this.resolveAdapter(job.platform)

    if (!adapter) {
      throw new Error(`No import adapter found for platform '${job.platform}'.`)
    }

    return adapter.testConnection(job.credentials ?? {})
  }

  // --------------------------------------------------------------------------
  // Run
  // --------------------------------------------------------------------------

  /**
   * Execute the import for a job. Supports both fresh starts and resume.
   *
   * @param job        - The ImportJob to run.
   * @param onProgress - Optional callback fired after each batch:
   *                     `(entityType, progressData) => void`
   */
  async run(
    job: ImportJob,
    onProgress?: (entityType: string, progress: Record<string, any>) => void
  ): Promise<void> {
    const adapter = await this.resolveAdapter(job.platform)

    if (!adapter) {
      job.status = 'failed'
      await job.save()
      throw new Error(`No import adapter found for platform '${job.platform}'.`)
    }

    // Support resume: only transition if not already importing
    if (job.status !== 'importing') {
      await job.transitionTo('importing')
    }

    // Record start time on first run
    if (!job.startedAt) {
      job.startedAt = DateTime.now()
      await job.save()
    }

    // Provide job ID to adapter if it needs cross-entity resolution
    if (typeof adapter.setJobId === 'function') {
      adapter.setJobId(job.id)
    }

    await ImportContext.suppress(async () => {
      for (const entityType of adapter.entityTypes()) {
        // Check for pause between entity types
        await job.refresh()

        if (job.status === 'paused') {
          return
        }

        await this.importEntityType(job, adapter, entityType, onProgress)
      }
    })

    await job.refresh()

    // Paused mid-import — leave status as-is, caller can resume later
    if (job.status === 'paused') {
      return
    }

    job.status = 'completed'
    job.completedAt = DateTime.now()
    await job.save()

    await job.purgeCredentials()

    // Fire post-import action so listeners can reindex, rebuild caches, etc.
    await escalated_doAction('import.completed', job)
  }

  // --------------------------------------------------------------------------
  // Entity-type loop
  // --------------------------------------------------------------------------

  private async importEntityType(
    job: ImportJob,
    adapter: ImportAdapter,
    entityType: string,
    onProgress?: (entityType: string, progress: Record<string, any>) => void
  ): Promise<void> {
    let cursor = job.getEntityCursor(entityType)
    let processed = job.progress?.[entityType]?.processed ?? 0
    let skipped = job.progress?.[entityType]?.skipped ?? 0
    let failed = job.progress?.[entityType]?.failed ?? 0

    do {
      const result = await adapter.extract(entityType, job.credentials ?? {}, cursor)

      if (result.totalCount !== null) {
        await job.updateEntityProgress(entityType, { total: result.totalCount })
      }

      for (const record of result.records) {
        const sourceId: string | undefined = record['source_id']

        if (!sourceId) {
          failed++
          continue
        }

        // Skip already-imported records (idempotent resume)
        if (await ImportSourceMap.hasBeenImported(job.id, entityType, sourceId)) {
          skipped++
          continue
        }

        try {
          const escalatedId = await this.persistRecord(job, entityType, record)

          await ImportSourceMap.create({
            importJobId: job.id,
            entityType,
            sourceId,
            escalatedId: String(escalatedId),
          })

          processed++
        } catch (err: any) {
          failed++
          await job.appendError(entityType, sourceId, err.message ?? String(err))
        }
      }

      cursor = result.cursor

      await job.updateEntityProgress(entityType, {
        processed,
        skipped,
        failed,
        cursor,
      })

      if (onProgress) {
        onProgress(entityType, job.progress?.[entityType] ?? {})
      }

      // Check for pause between batches
      await job.refresh()

      if (job.status === 'paused') {
        return
      }
    } while (!result.isExhausted())
  }

  // --------------------------------------------------------------------------
  // Record persistence
  // --------------------------------------------------------------------------

  /**
   * Dispatch a normalized record to the appropriate entity-specific
   * persistence method and return the resulting Escalated ID.
   */
  private async persistRecord(
    job: ImportJob,
    entityType: string,
    record: Record<string, any>
  ): Promise<string | number> {
    const mappings: Record<string, string> = job.fieldMappings?.[entityType] ?? {}

    switch (entityType) {
      case 'agents':
        return this.persistAgent(record, mappings)
      case 'tags':
        return this.persistTag(record, mappings)
      case 'custom_fields':
        return this.persistCustomField(record, mappings)
      case 'contacts':
        return this.persistContact(record, mappings)
      case 'departments':
        return this.persistDepartment(record, mappings)
      case 'tickets':
        return this.persistTicket(job, record, mappings)
      case 'replies':
        return this.persistReply(job, record, mappings)
      case 'attachments':
        return this.persistAttachment(job, record, mappings)
      case 'satisfaction_ratings':
        return this.persistSatisfactionRating(job, record, mappings)
      default:
        throw new Error(`Unknown entity type: ${entityType}`)
    }
  }

  // --------------------------------------------------------------------------
  // Entity-specific persistence
  // --------------------------------------------------------------------------

  private async persistTag(
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    const { default: Tag } = await import('../models/tag.js')

    const slug = string.slug(record['name'] ?? '')
    const tag = await Tag.firstOrCreate({ slug }, { name: record['name'], slug })

    return tag.id
  }

  private async persistAgent(
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    const config = (globalThis as any).__escalated_config
    const userModelName: string = config?.userModel ?? 'User'
    const { default: db } = await import('@adonisjs/lucid/services/db')

    const user = await db
      .from(this.inferUserTable(userModelName))
      .where('email', record['email'])
      .first()

    if (!user) {
      throw new Error(
        `Agent with email '${record['email']}' not found in host application. ` +
        `Ensure all agents exist before importing tickets.`
      )
    }

    return user.id
  }

  private async persistContact(
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    const config = (globalThis as any).__escalated_config
    const userModelName: string = config?.userModel ?? 'User'
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const table = this.inferUserTable(userModelName)

    let user = await db.from(table).where('email', record['email']).first()

    if (!user) {
      const [id] = await db.table(table).insert({
        email: record['email'],
        name: record['name'] ?? record['email'],
        created_at: new Date(),
        updated_at: new Date(),
      })
      return id
    }

    return user.id
  }

  private async persistDepartment(
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    const { default: Department } = await import('../models/department.js')

    const slug = string.slug(record['name'] ?? '')
    const dept = await Department.firstOrCreate(
      { slug },
      { name: record['name'], slug, isActive: true }
    )

    return dept.id
  }

  private async persistTicket(
    job: ImportJob,
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    const { default: Ticket } = await import('../models/ticket.js')

    const requesterId = record['requester_source_id']
      ? await ImportSourceMap.resolve(job.id, 'contacts', record['requester_source_id'])
      : null

    const assigneeId = record['assignee_source_id']
      ? await ImportSourceMap.resolve(job.id, 'agents', record['assignee_source_id'])
      : null

    const departmentId = record['department_source_id']
      ? await ImportSourceMap.resolve(job.id, 'departments', record['department_source_id'])
      : null

    const config = (globalThis as any).__escalated_config
    const userModelName: string = config?.userModel ?? 'User'

    const reference = await Ticket.generateReference()

    const ticket = new Ticket()
    ticket.$attributes = {} // reset to avoid auto-assigns triggering hooks

    ticket.reference = reference
    ticket.subject = record['title'] ?? record['subject'] ?? 'Imported ticket'
    ticket.description = record['description'] ?? record['body'] ?? ''
    ticket.status = (record['status'] as TicketStatus) ?? 'open'
    ticket.priority = (record['priority'] as TicketPriority) ?? 'medium'
    ticket.channel = record['channel'] ?? 'import'
    ticket.assignedTo = assigneeId ? Number(assigneeId) : null
    ticket.departmentId = departmentId ? Number(departmentId) : null
    ticket.metadata = record['metadata'] ?? null
    ticket.slaFirstResponseBreached = false
    ticket.slaResolutionBreached = false

    if (requesterId) {
      ticket.requesterType = userModelName
      ticket.requesterId = Number(requesterId)
    }

    if (record['created_at']) {
      ticket.createdAt = DateTime.fromISO(record['created_at'])
    }
    if (record['updated_at']) {
      ticket.updatedAt = DateTime.fromISO(record['updated_at'])
    }

    await ticket.save()

    // Attach tags
    if (Array.isArray(record['tag_source_ids']) && record['tag_source_ids'].length > 0) {
      const tagIds: number[] = []
      for (const sid of record['tag_source_ids']) {
        const tagId = await ImportSourceMap.resolve(job.id, 'tags', sid)
        if (tagId) tagIds.push(Number(tagId))
      }
      if (tagIds.length > 0) {
        await ticket.related('tags').sync(tagIds)
      }
    }

    return ticket.id
  }

  private async persistReply(
    job: ImportJob,
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    const { default: Reply } = await import('../models/reply.js')

    const ticketId = await ImportSourceMap.resolve(
      job.id,
      'tickets',
      record['ticket_source_id'] ?? ''
    )

    if (!ticketId) {
      throw new Error(`Parent ticket not found for reply (ticket_source_id: ${record['ticket_source_id']}).`)
    }

    const config = (globalThis as any).__escalated_config
    const userModelName: string = config?.userModel ?? 'User'

    let authorId: number | null = null
    let authorType: string | null = null

    if (record['author_source_id']) {
      const agentId = await ImportSourceMap.resolve(job.id, 'agents', record['author_source_id'])
      const contactId = agentId
        ? null
        : await ImportSourceMap.resolve(job.id, 'contacts', record['author_source_id'])

      const resolvedId = agentId ?? contactId
      if (resolvedId) {
        authorId = Number(resolvedId)
        authorType = userModelName
      }
    }

    const reply = new Reply()
    reply.ticketId = Number(ticketId)
    reply.body = record['body'] ?? ''
    reply.isInternalNote = record['is_internal_note'] ?? false
    reply.isPinned = false
    reply.type = record['is_internal_note'] ? 'note' : 'reply'
    reply.authorType = authorType
    reply.authorId = authorId

    if (record['created_at']) {
      reply.createdAt = DateTime.fromISO(record['created_at'])
    }
    if (record['updated_at']) {
      reply.updatedAt = DateTime.fromISO(record['updated_at'])
    }

    await reply.save()

    return reply.id
  }

  private async persistAttachment(
    job: ImportJob,
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    const { default: Attachment } = await import('../models/attachment.js')

    const parentType: string = record['parent_type'] ?? 'reply'
    const parentSourceId: string = record['parent_source_id'] ?? ''

    const parentId = await ImportSourceMap.resolve(
      job.id,
      parentType === 'ticket' ? 'tickets' : 'replies',
      parentSourceId
    )

    if (!parentId) {
      throw new Error(
        `Parent ${parentType} not found for attachment (parent_source_id: ${parentSourceId}).`
      )
    }

    const config = (globalThis as any).__escalated_config
    const disk: string = config?.storage?.disk ?? 'local'

    const attachment = await Attachment.create({
      attachableType: parentType === 'ticket' ? 'Ticket' : 'Reply',
      attachableId: Number(parentId),
      filename: record['filename'] ?? 'unknown',
      originalFilename: record['original_filename'] ?? record['filename'] ?? 'unknown',
      mimeType: record['mime_type'] ?? 'application/octet-stream',
      size: record['size'] ?? 0,
      disk,
      path: record['path'] ?? '',
    })

    return attachment.id
  }

  private async persistCustomField(
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    // CustomField model may not exist in all host apps — use raw DB if not found
    try {
      const { default: db } = await import('@adonisjs/lucid/services/db')
      const slug = string.slug(record['name'] ?? '')

      let field = await db
        .from('escalated_custom_fields')
        .where('slug', slug)
        .first()

      if (!field) {
        const [id] = await db.table('escalated_custom_fields').insert({
          slug,
          name: record['name'],
          type: record['type'] ?? 'text',
          options: record['options'] ? JSON.stringify(record['options']) : null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        return id
      }

      return field.id
    } catch {
      throw new Error(`Cannot persist custom_fields — table escalated_custom_fields not found.`)
    }
  }

  private async persistSatisfactionRating(
    job: ImportJob,
    record: Record<string, any>,
    _mappings: Record<string, string>
  ): Promise<string | number> {
    const { default: SatisfactionRating } = await import('../models/satisfaction_rating.js')

    const ticketId = await ImportSourceMap.resolve(
      job.id,
      'tickets',
      record['ticket_source_id'] ?? ''
    )

    if (!ticketId) {
      throw new Error(
        `Ticket not found for satisfaction rating (ticket_source_id: ${record['ticket_source_id']}).`
      )
    }

    const rating = await SatisfactionRating.create({
      ticketId: Number(ticketId),
      rating: record['rating'] ?? record['score'] ?? null,
      comment: record['comment'] ?? null,
    })

    return rating.id
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Naively infer the DB table name from a user model name.
   * Host apps typically follow `User → users` or `AppUser → app_users`.
   */
  private inferUserTable(modelName: string): string {
    // CamelCase → snake_case → pluralize
    const snake = modelName.replace(/([A-Z])/g, (m, c, i) => (i > 0 ? '_' : '') + c.toLowerCase())
    return snake.endsWith('s') ? snake : `${snake}s`
  }
}
