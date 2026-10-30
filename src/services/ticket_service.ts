import {
  assertTicketAccess,
  resolveTicketAccount,
  accountCondition,
} from '../support/ticket_access.js'
import SlaService from './sla_service.js'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Tag from '../models/tag.js'
import TicketActivity from '../models/ticket_activity.js'
import CustomStatus from '../models/custom_status.js'
import { isBuiltInStatus } from '../support/custom_statuses.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import {
  canTransitionTo,
  ALLOWED_SORT_COLUMNS,
  type TicketStatus,
  type TicketPriority,
  type ActivityType,
} from '../types.js'
import AttachmentService from './attachment_service.js'
import ImportContext from '../support/import_context.js'

export default class TicketService {
  constructor(protected attachmentService: AttachmentService = new AttachmentService()) {}

  /**
   * Create a new ticket from an authenticated user.
   */
  async create(
    requester: { id: number; constructor: { name: string } },
    data: {
      subject: string
      description: string
      priority?: string
      ticketType?: string
      channel?: string
      departmentId?: number | null
      metadata?: Record<string, any>
      attachments?: any[]
      tags?: number[]
    }
  ): Promise<Ticket> {
    const reference = await Ticket.generateReference()
    const configModule = await import('../helpers/config.js')
    const config = configModule.getConfig()

    const account = await resolveTicketAccount({
      kind: 'requester',
      type: requester.constructor.name,
      id: requester.id,
      model: requester,
    })
    const ticket = await Ticket.create({
      accountType: account?.type ?? null,
      accountId: account ? String(account.id) : null,
      reference,
      requesterType: requester.constructor.name,
      requesterId: requester.id,
      subject: data.subject,
      description: data.description,
      status: 'open' as TicketStatus,
      priority: (data.priority || config.defaultPriority) as TicketPriority,
      ticketType: Ticket.TYPES.includes(data.ticketType as any) ? data.ticketType! : 'question',
      channel: data.channel || 'web',
      departmentId: data.departmentId ?? null,
      metadata: data.metadata ?? null,
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    if (config.sla?.enabled && !ticket.slaPolicyId)
      await new SlaService().attachDefaultPolicy(ticket)

    if (data.attachments && data.attachments.length > 0) {
      await this.attachmentService.storeMany('Ticket', ticket.id, data.attachments)
    }

    if (data.tags && data.tags.length > 0) {
      await ticket.related('tags').sync(data.tags)
    }

    await this.logActivity(ticket, 'status_changed', requester, {
      new_status: 'open',
    })

    if (!ImportContext.isImporting()) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })
    }

    return ticket.refresh()
  }

  /**
   * Open a ticket for a system caller (an SDK or native plugin) whose
   * requester is a contact or nobody, never a user it names. The same
   * bookkeeping as `create()`: default priority and type, the default SLA,
   * the opening activity by `causer` and TICKET_CREATED (notifications,
   * webhooks, workflows, plugins). A status other than open is reached
   * through `changeStatus()`, so it is checked, logged and announced like any
   * status change; one open cannot move to is refused before anything is
   * written.
   */
  async createForSystem(
    data: {
      subject: string
      description?: string
      priority?: string
      status?: string
      ticketType?: string
      channel?: string
      departmentId?: number | null
      metadata?: Record<string, any> | null
      contactId?: number | null
    },
    causer?: any
  ): Promise<Ticket> {
    const target = data.status !== undefined ? await CustomStatus.resolveTarget(data.status) : null
    const moves = target !== null && (target.status !== 'open' || target.custom !== null)
    if (target && target.status !== 'open' && !canTransitionTo('open', target.status)) {
      throw new Error(`A new ticket cannot be ${String(data.status)}`)
    }

    const { getConfig } = await import('../helpers/config.js')
    const config = getConfig()
    const ticket = await Ticket.create({
      reference: await Ticket.generateReference(),
      requesterType: null,
      requesterId: null,
      contactId: data.contactId ?? null,
      subject: data.subject,
      description: data.description ?? '',
      status: 'open' as TicketStatus,
      priority: (data.priority || config.defaultPriority || 'medium') as TicketPriority,
      ticketType: Ticket.TYPES.includes(data.ticketType as any) ? data.ticketType! : 'question',
      channel: data.channel || 'api',
      departmentId: data.departmentId ?? null,
      metadata: data.metadata ?? null,
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)

    if (config.sla?.enabled && !ticket.slaPolicyId)
      await new SlaService().attachDefaultPolicy(ticket)

    await this.logActivity(ticket, 'status_changed', causer, { new_status: 'open' })

    if (!ImportContext.isImporting()) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })
    }

    if (moves) return this.changeStatus(await ticket.refresh(), data.status!, causer)
    return ticket.refresh()
  }

  /**
   * Create a ticket from a guest: the guest form and the widget.
   *
   * Applies the admin's guest policy, dedupes the submitter into a Contact,
   * attaches the default SLA and emits TICKET_CREATED, the same as
   * `create()`, so notifications, webhooks, workflows and plugin hooks see
   * guest tickets too. Whether guest tickets are allowed at all is the
   * caller's check (`EscalatedSetting.guestTicketsEnabled()`).
   */
  async createGuest(data: {
    name?: string | null
    email: string
    subject: string
    description: string
    priority?: string | null
    channel: string
    departmentId?: number | null
    metadata?: Record<string, any> | null
    attachments?: any[]
    /**
     * The guest proved the mailbox (docs/guest-access.md). The ticket is
     * marked verified and gets no permanent token; the caller issues a grant.
     */
    verified?: boolean
  }): Promise<Ticket> {
    const { randomBytes } = await import('node:crypto')
    const { emailDigest } = await import('../support/guest_access.js')
    const { getConfig } = await import('../helpers/config.js')
    const { resolveGuestPolicy } = await import('../helpers/guest_policy.js')
    const { default: Contact } = await import('../models/contact.js')
    const config = getConfig()

    const policy = await resolveGuestPolicy()
    // Dedupe repeat guests by email (Pattern B). Inline guest_* fields
    // remain populated for the backwards-compat dual-read period.
    const contact = await Contact.findOrCreateByEmail(data.email, data.name)
    const account = policy.requester
      ? await resolveTicketAccount({
          kind: 'requester',
          type: policy.requesterType!,
          id: policy.requesterId!,
          model: policy.requester,
        })
      : null

    const priorities: readonly string[] = config.priorities?.length
      ? config.priorities
      : ['low', 'medium', 'high', 'urgent', 'critical']
    const priority =
      data.priority && priorities.includes(data.priority)
        ? data.priority
        : config.defaultPriority || 'medium'

    const ticket = await Ticket.create({
      accountType: account?.type ?? null,
      accountId: account ? String(account.id) : null,
      reference: await Ticket.generateReference(),
      requesterType: policy.requesterType,
      requesterId: policy.requesterId,
      guestName: data.name || null,
      guestEmail: data.email,
      // Verified tickets are opened by expiring grants. Unverified ones (host
      // code calling this directly) keep the legacy 64-hex token, which only
      // opens anything with `guestAccess.legacyTokens`.
      guestToken: data.verified ? null : randomBytes(32).toString('hex'),
      guestVerifiedEmail: data.verified ? await emailDigest(data.email) : null,
      guestEmailVerifiedAt: data.verified ? DateTime.now() : null,
      contactId: contact.id,
      subject: data.subject,
      description: data.description,
      status: 'open' as TicketStatus,
      priority: priority as TicketPriority,
      ticketType: 'question',
      channel: data.channel,
      departmentId: data.departmentId ?? null,
      metadata: data.metadata ?? null,
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    if (config.sla?.enabled && !ticket.slaPolicyId)
      await new SlaService().attachDefaultPolicy(ticket)

    if (data.attachments && data.attachments.length > 0) {
      await this.attachmentService.storeMany('Ticket', ticket.id, data.attachments)
    }

    await this.logActivity(ticket, 'status_changed', policy.requester ?? null, {
      new_status: 'open',
    })

    if (!ImportContext.isImporting()) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })
    }

    return ticket.refresh()
  }

  /**
   * Update a ticket's basic fields.
   */
  async update(
    ticket: Ticket,
    data: { subject?: string; description?: string; metadata?: Record<string, any> | null }
  ): Promise<Ticket> {
    await assertTicketAccess(ticket)
    ticket.merge({
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    })
    await ticket.save()

    if (!ImportContext.isImporting()) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_UPDATED, { ticket })
    }

    return ticket.refresh()
  }

  /**
   * Change ticket status with transition validation.
   *
   * `target` is a built-in status, a custom status slug, or a CustomStatus. A
   * custom status moves the ticket to its category's built-in anchor
   * (src/support/custom_statuses.ts), so the anchor's transition check, dates
   * and events apply; a built-in status clears the custom one. A move between
   * two custom statuses with the same anchor skips the transition check but
   * is still saved and still emits `ticket.status_changed`.
   */
  async changeStatus(
    ticket: Ticket,
    target: TicketStatus | string | CustomStatus,
    causer?: any
  ): Promise<Ticket> {
    await assertTicketAccess(ticket)
    const resolved = await CustomStatus.resolveTarget(target)
    const newStatus = resolved.status
    const oldStatus = ticket.status
    const oldCustom = ticket.ticketStatusId ? await CustomStatus.find(ticket.ticketStatusId) : null
    const newCustom = resolved.custom
    const sameStatus = oldStatus === newStatus
    const customChanges = (oldCustom?.id ?? null) !== (newCustom?.id ?? null)

    if (!(sameStatus && (newCustom || customChanges)) && !canTransitionTo(oldStatus, newStatus)) {
      throw new Error(`Cannot transition from ${oldStatus} to ${newStatus}`)
    }

    ticket.applyStatusTarget(resolved)

    if (sameStatus) {
      // A sub-status move: the built-in status, and its dates, are unchanged.
    } else if (newStatus === 'resolved') {
      ticket.resolvedAt = DateTime.now()
    } else if (newStatus === 'closed') {
      ticket.closedAt = DateTime.now()
    } else if (newStatus === 'reopened') {
      ticket.resolvedAt = null
      ticket.closedAt = null
    }

    await ticket.save()

    const custom = {
      oldCustomStatus: oldCustom?.slug ?? null,
      newCustomStatus: newCustom?.slug ?? null,
      oldCategory: CustomStatus.categoryOf(oldStatus, oldCustom),
      newCategory: CustomStatus.categoryOf(newStatus, newCustom),
    }

    await this.logActivity(ticket, 'status_changed', causer, {
      old_status: oldStatus,
      new_status: newStatus,
      ...(oldCustom || newCustom
        ? { old_custom_status: custom.oldCustomStatus, new_custom_status: custom.newCustomStatus }
        : {}),
    })

    if (!ImportContext.isImporting()) {
      const followerUserIds = await ticket.followerUserIds(causer?.id)
      await emitter.emit(ESCALATED_EVENTS.TICKET_STATUS_CHANGED, {
        ticket,
        oldStatus,
        newStatus,
        causer,
        followerUserIds,
        ...custom,
      })

      if (sameStatus) {
        // Nothing the built-in status implies has changed.
      } else if (newStatus === 'resolved') {
        await emitter.emit(ESCALATED_EVENTS.TICKET_RESOLVED, { ticket, causer })
      } else if (newStatus === 'closed') {
        await emitter.emit(ESCALATED_EVENTS.TICKET_CLOSED, { ticket, causer })
      } else if (newStatus === 'reopened') {
        await emitter.emit(ESCALATED_EVENTS.TICKET_REOPENED, { ticket, causer })
      } else if (newStatus === 'escalated') {
        await emitter.emit(ESCALATED_EVENTS.TICKET_ESCALATED, { ticket })
      }
    }

    return ticket.refresh()
  }

  /**
   * Add a reply to a ticket.
   */
  async reply(
    ticket: Ticket,
    author: { id: number; constructor: { name: string } } | null,
    body: string,
    attachments: any[] = []
  ): Promise<Reply> {
    await assertTicketAccess(ticket)
    const reply = await Reply.create({
      ticketId: ticket.id,
      authorType: author?.constructor.name ?? null,
      authorId: author?.id ?? null,
      body,
      isInternalNote: false,
      isPinned: false,
      type: 'reply',
    })

    if (attachments.length > 0) {
      await this.attachmentService.storeMany('Reply', reply.id, attachments)
    }

    await this.logActivity(ticket, 'replied', author ?? undefined)

    if (!ImportContext.isImporting()) {
      const followerUserIds = await ticket.followerUserIds(author?.id)
      await emitter.emit(ESCALATED_EVENTS.REPLY_CREATED, { reply, followerUserIds })
    }

    return reply.refresh()
  }

  /**
   * Add an internal note to a ticket.
   */
  async addNote(
    ticket: Ticket,
    author: { id: number; constructor: { name: string } } | null,
    body: string,
    attachments: any[] = []
  ): Promise<Reply> {
    await assertTicketAccess(ticket)
    const reply = await Reply.create({
      ticketId: ticket.id,
      authorType: author?.constructor.name ?? null,
      authorId: author?.id ?? null,
      body,
      isInternalNote: true,
      isPinned: false,
      type: 'note',
    })

    if (attachments.length > 0) {
      await this.attachmentService.storeMany('Reply', reply.id, attachments)
    }

    await this.logActivity(ticket, 'note_added', author ?? undefined)

    if (!ImportContext.isImporting()) {
      await emitter.emit(ESCALATED_EVENTS.INTERNAL_NOTE_ADDED, { reply })
    }

    return reply.refresh()
  }

  /**
   * Change ticket priority.
   */
  async changePriority(ticket: Ticket, priority: TicketPriority, causer?: any): Promise<Ticket> {
    await assertTicketAccess(ticket)
    const oldPriority = ticket.priority
    ticket.priority = priority
    await ticket.save()

    await this.logActivity(ticket, 'priority_changed', causer, {
      old_priority: oldPriority,
      new_priority: priority,
    })

    if (!ImportContext.isImporting()) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_PRIORITY_CHANGED, {
        ticket,
        oldPriority,
        newPriority: priority,
        causer,
      })
    }

    return ticket.refresh()
  }

  /**
   * Add tags to a ticket.
   */
  async addTags(ticket: Ticket, tagIds: number[], causer?: any): Promise<Ticket> {
    await assertTicketAccess(ticket)
    await ticket.related('tags').attach(tagIds)

    for (const tagId of tagIds) {
      await this.logActivity(ticket, 'tag_added', causer, { tag_id: tagId })

      const tag = await Tag.find(tagId)
      if (tag && !ImportContext.isImporting()) {
        await emitter.emit(ESCALATED_EVENTS.TAG_ADDED, { ticket, tag })
      }
    }

    return ticket.refresh()
  }

  /**
   * Remove tags from a ticket.
   */
  async removeTags(ticket: Ticket, tagIds: number[], causer?: any): Promise<Ticket> {
    await assertTicketAccess(ticket)
    await ticket.related('tags').detach(tagIds)

    for (const tagId of tagIds) {
      await this.logActivity(ticket, 'tag_removed', causer, { tag_id: tagId })

      const tag = await Tag.find(tagId)
      if (tag && !ImportContext.isImporting()) {
        await emitter.emit(ESCALATED_EVENTS.TAG_REMOVED, { ticket, tag })
      }
    }

    return ticket.refresh()
  }

  /**
   * Change ticket department.
   */
  async changeDepartment(ticket: Ticket, departmentId: number, causer?: any): Promise<Ticket> {
    await assertTicketAccess(ticket)
    const oldDepartmentId = ticket.departmentId
    ticket.departmentId = departmentId
    await ticket.save()

    await this.logActivity(ticket, 'department_changed', causer, {
      old_department_id: oldDepartmentId,
      new_department_id: departmentId,
    })

    if (!ImportContext.isImporting()) {
      await emitter.emit(ESCALATED_EVENTS.DEPARTMENT_CHANGED, {
        ticket,
        oldDepartmentId,
        newDepartmentId: departmentId,
        causer,
      })
    }

    return ticket.refresh()
  }

  /**
   * Close a ticket.
   */
  async close(ticket: Ticket, causer?: any): Promise<Ticket> {
    await assertTicketAccess(ticket)
    return this.changeStatus(ticket, 'closed', causer)
  }

  /**
   * Resolve a ticket.
   */
  async resolve(ticket: Ticket, causer?: any): Promise<Ticket> {
    await assertTicketAccess(ticket)
    return this.changeStatus(ticket, 'resolved', causer)
  }

  /**
   * Reopen a ticket.
   */
  async reopen(ticket: Ticket, causer?: any): Promise<Ticket> {
    await assertTicketAccess(ticket)
    return this.changeStatus(ticket, 'reopened', causer)
  }

  /**
   * List tickets with filtering, sorting, and pagination.
   */
  async list(
    filters: Record<string, any> = {},
    forUser?: { id: number; constructor: { name: string } } | null
  ) {
    const query = Ticket.query()
      .preload('department')
      .preload('tags')
      .select('escalated_tickets.*')
      .select(
        db.rawQuery(
          '(select max(r.created_at) from escalated_replies r where r.ticket_id = escalated_tickets.id and r.deleted_at is null) as last_reply_at'
        )
      )

    // If listing for a specific user (customer view)
    if (forUser) {
      query.where('requester_type', forUser.constructor.name).where('requester_id', forUser.id)
    }

    if (filters.status) {
      // A custom status slug filters by the sub-status; anything else by the
      // built-in column, as before. Not for a customer's own list: custom
      // statuses are internal.
      const customerList = forUser && !filters.following
      const custom =
        isBuiltInStatus(filters.status) || customerList
          ? null
          : await CustomStatus.query()
              .where('slug', String(filters.status))
              .where('is_system', false)
              .first()
      if (custom) {
        query.where('ticket_status_id', custom.id)
      } else {
        query.where('status', filters.status)
      }
    }

    if (filters.priority) {
      query.where('priority', filters.priority)
    }

    if (filters.ticket_type) {
      query.where('ticket_type', filters.ticket_type)
    }

    if (filters.assigned_to) {
      query.where('assigned_to', filters.assigned_to)
    }

    if (filters.unassigned) {
      query.whereNull('assigned_to')
    }

    if (filters.account_type !== undefined || filters.account_id !== undefined) {
      accountCondition(query, { type: filters.account_type, id: filters.account_id })
    }
    if (filters.department_id) {
      query.where('department_id', filters.department_id)
    }

    if (filters.search) {
      query.where((q) => {
        q.where('subject', 'like', `%${filters.search}%`)
          .orWhere('reference', 'like', `%${filters.search}%`)
          .orWhere('description', 'like', `%${filters.search}%`)
      })
    }

    if (filters.sla_breached) {
      query.where((q) => {
        q.where('sla_first_response_breached', true).orWhere('sla_resolution_breached', true)
      })
    }

    if (filters.tag_ids) {
      query.whereHas('tags', (q) => {
        q.whereIn('id', filters.tag_ids)
      })
    }

    if (filters.following && forUser) {
      const { default: lucidDb } = await import('@adonisjs/lucid/services/db')
      const followerTicketIds = await lucidDb
        .from('escalated_ticket_followers')
        .where('user_id', forUser.id)
        .select('ticket_id')
      query.whereIn(
        'id',
        followerTicketIds.map((r: any) => r.ticket_id)
      )
    }

    const sortBy = ALLOWED_SORT_COLUMNS.includes(filters.sort_by ?? '')
      ? filters.sort_by
      : 'created_at'
    const sortDir = (filters.sort_dir ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

    query.orderBy(sortBy, sortDir as 'asc' | 'desc')

    return query.paginate(1, filters.per_page ?? 15)
  }

  /**
   * Snooze a ticket until a given date/time.
   *
   * Saves the current status so it can be restored when the ticket is unsnoozed.
   */
  async snoozeTicket(
    ticket: Ticket,
    until: DateTime,
    causer: { id: number; constructor: { name: string } }
  ): Promise<Ticket> {
    ticket.statusBeforeSnooze = ticket.status
    ticket.snoozedUntil = until
    ticket.snoozedBy = causer.id
    ticket.status = 'waiting_on_customer' as TicketStatus
    // A built-in status, even when the ticket was already waiting on the
    // customer under a custom status. Unsnoozing does not bring it back.
    ticket.ticketStatusId = null
    await ticket.save()

    await this.logActivity(ticket, 'status_changed', causer, {
      action: 'snoozed',
      snoozed_until: until.toISO(),
      old_status: ticket.statusBeforeSnooze,
    })

    return ticket.refresh()
  }

  /**
   * Unsnooze a ticket, restoring its previous status.
   */
  async unsnoozeTicket(ticket: Ticket, causer?: any): Promise<Ticket> {
    const previousStatus = (ticket.statusBeforeSnooze || 'open') as TicketStatus
    ticket.status = previousStatus
    ticket.ticketStatusId = null
    ticket.snoozedUntil = null
    ticket.snoozedBy = null
    ticket.statusBeforeSnooze = null
    await ticket.save()

    await this.logActivity(ticket, 'status_changed', causer, {
      action: 'unsnoozed',
      restored_status: previousStatus,
    })

    if (!ImportContext.isImporting()) {
      const followerUserIds = await ticket.followerUserIds(causer?.id)
      await emitter.emit(ESCALATED_EVENTS.TICKET_STATUS_CHANGED, {
        ticket,
        oldStatus: 'waiting_on_customer' as TicketStatus,
        newStatus: previousStatus,
        causer,
        followerUserIds,
      })
    }

    return ticket.refresh()
  }

  /**
   * Split a ticket by creating a new ticket from a specific reply.
   *
   * The new ticket inherits the original's priority, type, channel, department,
   * and tags. Both tickets are linked via metadata and an activity log entry
   * is recorded on each.
   */
  async splitTicket(
    sourceTicket: Ticket,
    replyId: number,
    causer: { id: number; constructor: { name: string } }
  ): Promise<Ticket> {
    await assertTicketAccess(sourceTicket)
    const reply = await Reply.query()
      .where('id', replyId)
      .where('ticket_id', sourceTicket.id)
      .firstOrFail()

    const reference = await Ticket.generateReference()

    const newTicket = await Ticket.create({
      reference,
      requesterType: reply.authorType,
      requesterId: reply.authorId,
      subject: `[Split] ${sourceTicket.subject}`,
      description: reply.body,
      status: 'open' as TicketStatus,
      priority: sourceTicket.priority,
      ticketType: sourceTicket.ticketType,
      channel: sourceTicket.channel,
      departmentId: sourceTicket.departmentId,
      accountType: sourceTicket.accountType,
      accountId: sourceTicket.accountId,
      metadata: {
        split_from_ticket_id: sourceTicket.id,
        split_from_reply_id: reply.id,
      },
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    // Copy tags from the source ticket
    await sourceTicket.load('tags')
    const tagIds = sourceTicket.tags.map((tag: Tag) => tag.id)
    if (tagIds.length > 0) {
      await newTicket.related('tags').sync(tagIds)
    }

    // Link back to new ticket on source metadata
    const sourceMetadata = sourceTicket.metadata ?? {}
    const splitTo = Array.isArray(sourceMetadata.split_to_ticket_ids)
      ? sourceMetadata.split_to_ticket_ids
      : []
    splitTo.push(newTicket.id)
    sourceTicket.metadata = { ...sourceMetadata, split_to_ticket_ids: splitTo }
    await sourceTicket.save()

    // Log activity on both tickets
    await this.logActivity(sourceTicket, 'status_changed', causer, {
      action: 'ticket_split',
      new_ticket_id: newTicket.id,
      reply_id: reply.id,
    })
    await this.logActivity(newTicket, 'status_changed', causer, {
      action: 'ticket_split_created',
      source_ticket_id: sourceTicket.id,
      reply_id: reply.id,
      new_status: 'open',
    })

    if (!ImportContext.isImporting()) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket: newTicket })
    }

    return newTicket.refresh()
  }

  // ---- Private ----

  protected async logActivity(
    ticket: Ticket,
    type: ActivityType,
    causer?: any,
    properties?: Record<string, any>
  ): Promise<void> {
    await TicketActivity.create({
      ticketId: ticket.id,
      type,
      causerType: causer?.constructor?.name ?? null,
      causerId: causer?.id ?? null,
      properties: properties ?? null,
    })
  }
}
