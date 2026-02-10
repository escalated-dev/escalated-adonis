import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Tag from '../models/tag.js'
import TicketActivity from '../models/ticket_activity.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import {
  canTransitionTo,
  ALLOWED_SORT_COLUMNS,
  type TicketStatus,
  type TicketPriority,
  type ActivityType,
} from '../types.js'
import AttachmentService from './attachment_service.js'

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
      channel?: string
      departmentId?: number | null
      metadata?: Record<string, any>
      attachments?: any[]
      tags?: number[]
    }
  ): Promise<Ticket> {
    const reference = await Ticket.generateReference()
    const config = (await import('../helpers/config.js')).getConfig()

    const ticket = await Ticket.create({
      reference,
      requesterType: requester.constructor.name,
      requesterId: requester.id,
      subject: data.subject,
      description: data.description,
      status: 'open' as TicketStatus,
      priority: (data.priority || config.defaultPriority) as TicketPriority,
      channel: data.channel || 'web',
      departmentId: data.departmentId ?? null,
      metadata: data.metadata ?? null,
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    if (data.attachments && data.attachments.length > 0) {
      await this.attachmentService.storeMany(
        'Ticket',
        ticket.id,
        data.attachments
      )
    }

    if (data.tags && data.tags.length > 0) {
      await ticket.related('tags').sync(data.tags)
    }

    await this.logActivity(ticket, 'status_changed', requester, {
      new_status: 'open',
    })

    await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })

    return ticket.refresh()
  }

  /**
   * Update a ticket's basic fields.
   */
  async update(
    ticket: Ticket,
    data: { subject?: string; description?: string; metadata?: Record<string, any> | null }
  ): Promise<Ticket> {
    ticket.merge({
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    })
    await ticket.save()

    await emitter.emit(ESCALATED_EVENTS.TICKET_UPDATED, { ticket })

    return ticket.refresh()
  }

  /**
   * Change ticket status with transition validation.
   */
  async changeStatus(
    ticket: Ticket,
    newStatus: TicketStatus,
    causer?: any
  ): Promise<Ticket> {
    const oldStatus = ticket.status

    if (!canTransitionTo(oldStatus, newStatus)) {
      throw new Error(`Cannot transition from ${oldStatus} to ${newStatus}`)
    }

    ticket.status = newStatus

    if (newStatus === 'resolved') {
      ticket.resolvedAt = DateTime.now()
    } else if (newStatus === 'closed') {
      ticket.closedAt = DateTime.now()
    } else if (newStatus === 'reopened') {
      ticket.resolvedAt = null
      ticket.closedAt = null
    }

    await ticket.save()

    await this.logActivity(ticket, 'status_changed', causer, {
      old_status: oldStatus,
      new_status: newStatus,
    })

    await emitter.emit(ESCALATED_EVENTS.TICKET_STATUS_CHANGED, {
      ticket,
      oldStatus,
      newStatus,
      causer,
    })

    if (newStatus === 'resolved') {
      await emitter.emit(ESCALATED_EVENTS.TICKET_RESOLVED, { ticket, causer })
    } else if (newStatus === 'closed') {
      await emitter.emit(ESCALATED_EVENTS.TICKET_CLOSED, { ticket, causer })
    } else if (newStatus === 'reopened') {
      await emitter.emit(ESCALATED_EVENTS.TICKET_REOPENED, { ticket, causer })
    } else if (newStatus === 'escalated') {
      await emitter.emit(ESCALATED_EVENTS.TICKET_ESCALATED, { ticket })
    }

    return ticket.refresh()
  }

  /**
   * Add a reply to a ticket.
   */
  async reply(
    ticket: Ticket,
    author: { id: number; constructor: { name: string } },
    body: string,
    attachments: any[] = []
  ): Promise<Reply> {
    const reply = await Reply.create({
      ticketId: ticket.id,
      authorType: author.constructor.name,
      authorId: author.id,
      body,
      isInternalNote: false,
      isPinned: false,
      type: 'reply',
    })

    if (attachments.length > 0) {
      await this.attachmentService.storeMany('Reply', reply.id, attachments)
    }

    await this.logActivity(ticket, 'replied', author)

    await emitter.emit(ESCALATED_EVENTS.REPLY_CREATED, { reply })

    return reply.refresh()
  }

  /**
   * Add an internal note to a ticket.
   */
  async addNote(
    ticket: Ticket,
    author: { id: number; constructor: { name: string } },
    body: string,
    attachments: any[] = []
  ): Promise<Reply> {
    const reply = await Reply.create({
      ticketId: ticket.id,
      authorType: author.constructor.name,
      authorId: author.id,
      body,
      isInternalNote: true,
      isPinned: false,
      type: 'note',
    })

    if (attachments.length > 0) {
      await this.attachmentService.storeMany('Reply', reply.id, attachments)
    }

    await this.logActivity(ticket, 'note_added', author)

    await emitter.emit(ESCALATED_EVENTS.INTERNAL_NOTE_ADDED, { reply })

    return reply.refresh()
  }

  /**
   * Change ticket priority.
   */
  async changePriority(
    ticket: Ticket,
    priority: TicketPriority,
    causer?: any
  ): Promise<Ticket> {
    const oldPriority = ticket.priority
    ticket.priority = priority
    await ticket.save()

    await this.logActivity(ticket, 'priority_changed', causer, {
      old_priority: oldPriority,
      new_priority: priority,
    })

    await emitter.emit(ESCALATED_EVENTS.TICKET_PRIORITY_CHANGED, {
      ticket,
      oldPriority,
      newPriority: priority,
      causer,
    })

    return ticket.refresh()
  }

  /**
   * Add tags to a ticket.
   */
  async addTags(
    ticket: Ticket,
    tagIds: number[],
    causer?: any
  ): Promise<Ticket> {
    await ticket.related('tags').attach(tagIds)

    for (const tagId of tagIds) {
      await this.logActivity(ticket, 'tag_added', causer, { tag_id: tagId })

      const tag = await Tag.find(tagId)
      if (tag) {
        await emitter.emit(ESCALATED_EVENTS.TAG_ADDED, { ticket, tag })
      }
    }

    return ticket.refresh()
  }

  /**
   * Remove tags from a ticket.
   */
  async removeTags(
    ticket: Ticket,
    tagIds: number[],
    causer?: any
  ): Promise<Ticket> {
    await ticket.related('tags').detach(tagIds)

    for (const tagId of tagIds) {
      await this.logActivity(ticket, 'tag_removed', causer, { tag_id: tagId })

      const tag = await Tag.find(tagId)
      if (tag) {
        await emitter.emit(ESCALATED_EVENTS.TAG_REMOVED, { ticket, tag })
      }
    }

    return ticket.refresh()
  }

  /**
   * Change ticket department.
   */
  async changeDepartment(
    ticket: Ticket,
    departmentId: number,
    causer?: any
  ): Promise<Ticket> {
    const oldDepartmentId = ticket.departmentId
    ticket.departmentId = departmentId
    await ticket.save()

    await this.logActivity(ticket, 'department_changed', causer, {
      old_department_id: oldDepartmentId,
      new_department_id: departmentId,
    })

    await emitter.emit(ESCALATED_EVENTS.DEPARTMENT_CHANGED, {
      ticket,
      oldDepartmentId,
      newDepartmentId: departmentId,
      causer,
    })

    return ticket.refresh()
  }

  /**
   * Close a ticket.
   */
  async close(ticket: Ticket, causer?: any): Promise<Ticket> {
    return this.changeStatus(ticket, 'closed', causer)
  }

  /**
   * Resolve a ticket.
   */
  async resolve(ticket: Ticket, causer?: any): Promise<Ticket> {
    return this.changeStatus(ticket, 'resolved', causer)
  }

  /**
   * Reopen a ticket.
   */
  async reopen(ticket: Ticket, causer?: any): Promise<Ticket> {
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

    // If listing for a specific user (customer view)
    if (forUser) {
      query
        .where('requester_type', forUser.constructor.name)
        .where('requester_id', forUser.id)
    }

    if (filters.status) {
      query.where('status', filters.status)
    }

    if (filters.priority) {
      query.where('priority', filters.priority)
    }

    if (filters.assigned_to) {
      query.where('assigned_to', filters.assigned_to)
    }

    if (filters.unassigned) {
      query.whereNull('assigned_to')
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
        q.where('sla_first_response_breached', true)
          .orWhere('sla_resolution_breached', true)
      })
    }

    if (filters.tag_ids) {
      query.whereHas('tags', (q) => {
        q.whereIn('id', filters.tag_ids)
      })
    }

    if (filters.following && forUser) {
      const { default: db } = await import('@adonisjs/lucid/services/db')
      const followerTicketIds = await db
        .from('escalated_ticket_followers')
        .where('user_id', forUser.id)
        .select('ticket_id')
      query.whereIn('id', followerTicketIds.map((r: any) => r.ticket_id))
    }

    const sortBy = ALLOWED_SORT_COLUMNS.includes(filters.sort_by ?? '')
      ? filters.sort_by
      : 'created_at'
    const sortDir = (filters.sort_dir ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

    query.orderBy(sortBy, sortDir as 'asc' | 'desc')

    return query.paginate(1, filters.per_page ?? 15)
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
