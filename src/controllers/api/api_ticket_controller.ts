import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../../models/ticket.js'
import Tag from '../../models/tag.js'
import Macro from '../../models/macro.js'
import TicketService from '../../services/ticket_service.js'
import AssignmentService from '../../services/assignment_service.js'
import MacroService from '../../services/macro_service.js'
import { STATUS_LABELS, PRIORITY_LABELS } from '../../types.js'
import type { TicketStatus, TicketPriority } from '../../types.js'

export default class ApiTicketController {
  protected ticketService = new TicketService()
  protected assignmentService = new AssignmentService()

  /**
   * GET /tickets — List tickets with pagination and filtering
   */
  async index(ctx: HttpContext) {
    const filters = ctx.request.only([
      'status', 'priority', 'assigned_to', 'unassigned', 'department_id',
      'search', 'sla_breached', 'tag_ids', 'sort_by', 'sort_dir', 'per_page', 'following',
    ])

    const user = (ctx as any).auth?.user ?? null
    const tickets = await this.ticketService.list(
      filters,
      filters.following ? user : null,
    )

    return ctx.response.json({
      data: tickets.all().map((t: Ticket) => this.formatTicketCollection(t)),
      meta: {
        current_page: tickets.currentPage,
        last_page: tickets.lastPage,
        per_page: tickets.perPage,
        total: tickets.total,
      },
    })
  }

  /**
   * GET /tickets/:ticket — Show ticket detail
   */
  async show(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket

    await ticket.load('department')
    await ticket.load('tags')
    await ticket.load('satisfactionRating')
    await ticket.load((loader: any) => {
      loader.load('replies', (query: any) => {
        query.orderBy('created_at', 'desc')
      })
      loader.load('activities', (query: any) => {
        query.orderBy('created_at', 'desc').limit(20)
      })
    })

    return ctx.response.json({
      data: this.formatTicketDetail(ticket),
    })
  }

  /**
   * POST /tickets — Create a new ticket
   */
  async store(ctx: HttpContext) {
    const user = (ctx as any).auth.user
    const data = ctx.request.only(['subject', 'description', 'priority', 'department_id', 'tags'])

    if (!data.subject || !data.description) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: {
          ...(!data.subject ? { subject: ['The subject field is required.'] } : {}),
          ...(!data.description ? { description: ['The description field is required.'] } : {}),
        },
      })
    }

    const ticket = await this.ticketService.create(user, {
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      departmentId: data.department_id ? Number(data.department_id) : null,
      tags: data.tags ? data.tags.map(Number) : undefined,
    })

    await ticket.load('department')
    await ticket.load('tags')

    return ctx.response.created({
      data: this.formatTicketDetail(ticket),
      message: 'Ticket created.',
    })
  }

  /**
   * POST /tickets/:reference/reply — Reply or add internal note
   */
  async reply(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = (ctx as any).auth.user
    const { body, is_internal_note } = ctx.request.only(['body', 'is_internal_note'])

    if (!body) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { body: ['The body field is required.'] },
      })
    }

    const isNote = !!is_internal_note

    let reply
    if (isNote) {
      reply = await this.ticketService.addNote(ticket, user, body)
    } else {
      reply = await this.ticketService.reply(ticket, user, body)
    }

    return ctx.response.created({
      data: {
        id: reply.id,
        body: reply.body,
        is_internal_note: reply.isInternalNote,
        author: { id: user.id, name: user.name ?? user.fullName ?? '' },
        created_at: reply.createdAt.toISO(),
      },
      message: isNote ? 'Note added.' : 'Reply sent.',
    })
  }

  /**
   * PATCH /tickets/:reference/status — Change ticket status
   */
  async status(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = (ctx as any).auth.user
    const { status } = ctx.request.only(['status'])

    if (!status) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { status: ['The status field is required.'] },
      })
    }

    try {
      await this.ticketService.changeStatus(ticket, status as TicketStatus, user)
    } catch (error: any) {
      return ctx.response.unprocessableEntity({
        message: error.message,
      })
    }

    return ctx.response.json({ message: 'Status updated.', status })
  }

  /**
   * PATCH /tickets/:reference/priority — Change ticket priority
   */
  async priority(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = (ctx as any).auth.user
    const { priority } = ctx.request.only(['priority'])

    if (!priority) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { priority: ['The priority field is required.'] },
      })
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent', 'critical']
    if (!validPriorities.includes(priority)) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { priority: ['The priority must be one of: low, medium, high, urgent, critical.'] },
      })
    }

    await this.ticketService.changePriority(ticket, priority as TicketPriority, user)

    return ctx.response.json({ message: 'Priority updated.', priority })
  }

  /**
   * POST /tickets/:reference/assign — Assign ticket to an agent
   */
  async assign(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = (ctx as any).auth.user
    const { agent_id } = ctx.request.only(['agent_id'])

    if (!agent_id) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { agent_id: ['The agent_id field is required.'] },
      })
    }

    await this.assignmentService.assign(ticket, Number(agent_id), user)

    return ctx.response.json({ message: 'Ticket assigned.' })
  }

  /**
   * POST /tickets/:reference/follow — Toggle follow/unfollow
   */
  async follow(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = (ctx as any).auth.user.id

    if (await ticket.isFollowedBy(userId)) {
      await ticket.unfollow(userId)
      return ctx.response.json({ message: 'Unfollowed ticket.', following: false })
    }

    await ticket.follow(userId)
    return ctx.response.json({ message: 'Following ticket.', following: true })
  }

  /**
   * POST /tickets/:reference/macro — Apply a macro
   */
  async applyMacro(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = (ctx as any).auth.user
    const { macro_id } = ctx.request.only(['macro_id'])

    if (!macro_id) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { macro_id: ['The macro_id field is required.'] },
      })
    }

    const macro = await Macro.query()
      .withScopes((scopes) => scopes.forAgent(user.id))
      .where('id', macro_id)
      .firstOrFail()

    const macroService = new MacroService()
    await macroService.apply(macro, ticket, user)

    return ctx.response.json({ message: `Macro "${macro.name}" applied.` })
  }

  /**
   * POST /tickets/:reference/tags — Update tags
   */
  async tags(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = (ctx as any).auth.user
    const { tag_ids } = ctx.request.only(['tag_ids'])

    if (!tag_ids || !Array.isArray(tag_ids)) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { tag_ids: ['The tag_ids field is required and must be an array.'] },
      })
    }

    const newTagIds = tag_ids.map(Number)

    await ticket.load('tags')
    const currentTagIds = ticket.tags.map((t: Tag) => t.id)

    const toAdd = newTagIds.filter((id: number) => !currentTagIds.includes(id))
    const toRemove = currentTagIds.filter((id: number) => !newTagIds.includes(id))

    if (toAdd.length) await this.ticketService.addTags(ticket, toAdd, user)
    if (toRemove.length) await this.ticketService.removeTags(ticket, toRemove, user)

    return ctx.response.json({ message: 'Tags updated.' })
  }

  /**
   * DELETE /tickets/:reference — Soft-delete a ticket
   */
  async destroy(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket

    ticket.deletedAt = (await import('luxon')).DateTime.now()
    await ticket.save()

    return ctx.response.json({ message: 'Ticket deleted.' })
  }

  // ---- Private Formatters ----

  /**
   * Format a ticket for collection (list) responses.
   * Matches the Laravel TicketCollectionResource output.
   */
  protected formatTicketCollection(ticket: Ticket): Record<string, any> {
    return {
      id: ticket.id,
      reference: ticket.reference,
      subject: ticket.subject,
      status: ticket.status,
      status_label: STATUS_LABELS[ticket.status as TicketStatus] ?? ticket.status,
      priority: ticket.priority,
      priority_label: PRIORITY_LABELS[ticket.priority as TicketPriority] ?? ticket.priority,
      requester: {
        name: ticket.requesterName,
        email: ticket.requesterEmail,
      },
      assignee: null, // Assignee is loaded separately via user model
      department: ticket.department ? {
        id: ticket.department.id,
        name: ticket.department.name,
      } : null,
      sla_breached: ticket.slaFirstResponseBreached || ticket.slaResolutionBreached,
      created_at: ticket.createdAt.toISO(),
      updated_at: ticket.updatedAt.toISO(),
    }
  }

  /**
   * Format a ticket for detail (show) responses.
   * Matches the Laravel TicketResource output.
   */
  protected formatTicketDetail(ticket: Ticket): Record<string, any> {
    const data: Record<string, any> = {
      id: ticket.id,
      reference: ticket.reference,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      status_label: STATUS_LABELS[ticket.status as TicketStatus] ?? ticket.status,
      priority: ticket.priority,
      priority_label: PRIORITY_LABELS[ticket.priority as TicketPriority] ?? ticket.priority,
      channel: ticket.channel,
      metadata: ticket.metadata,
      requester: {
        name: ticket.requesterName,
        email: ticket.requesterEmail,
      },
      assignee: null,
      department: ticket.department ? {
        id: ticket.department.id,
        name: ticket.department.name,
      } : null,
      tags: ticket.tags?.map((tag: Tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
      })) ?? [],
      replies: ticket.replies?.map((r: any) => ({
        id: r.id,
        body: r.body,
        is_internal_note: r.isInternalNote,
        is_pinned: r.isPinned ?? false,
        author: null, // Author loaded separately via user model
        attachments: r.attachments?.map((a: any) => ({
          id: a.id,
          filename: a.filename,
          mime_type: a.mimeType,
          size: a.size,
          url: a.url,
        })) ?? [],
        created_at: r.createdAt.toISO(),
      })) ?? [],
      activities: ticket.activities?.map((a: any) => ({
        id: a.id,
        type: a.type,
        causer: null, // Causer loaded separately via user model
        created_at: a.createdAt.toISO(),
      })) ?? [],
      sla: {
        first_response_due_at: ticket.firstResponseDueAt?.toISO() ?? null,
        first_response_at: ticket.firstResponseAt?.toISO() ?? null,
        first_response_breached: ticket.slaFirstResponseBreached,
        resolution_due_at: ticket.resolutionDueAt?.toISO() ?? null,
        resolution_breached: ticket.slaResolutionBreached,
      },
      resolved_at: ticket.resolvedAt?.toISO() ?? null,
      closed_at: ticket.closedAt?.toISO() ?? null,
      created_at: ticket.createdAt.toISO(),
      updated_at: ticket.updatedAt.toISO(),
    }

    return data
  }
}
