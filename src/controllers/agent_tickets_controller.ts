import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Department from '../models/department.js'
import Tag from '../models/tag.js'
import CannedResponse from '../models/canned_response.js'
import Macro from '../models/macro.js'
import TicketService from '../services/ticket_service.js'
import AssignmentService from '../services/assignment_service.js'
import MacroService from '../services/macro_service.js'
import type { TicketStatus, TicketPriority } from '../types.js'

export default class AgentTicketsController {
  protected ticketService = new TicketService()
  protected assignmentService = new AssignmentService()

  /**
   * GET /support/agent/tickets — List all tickets (agent view)
   */
  async index({ request, auth, inertia }: HttpContext) {
    const filters = request.only([
      'status', 'priority', 'assigned_to', 'unassigned', 'department_id',
      'search', 'sla_breached', 'tag_ids', 'sort_by', 'sort_dir', 'per_page', 'following',
    ])

    const tickets = await this.ticketService.list(
      filters,
      filters.following ? (auth.user as any) : null,
    )

    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    const tags = await Tag.query().select('id', 'name', 'color')

    return inertia.render('Escalated/Agent/TicketIndex', {
      tickets,
      filters: request.all(),
      departments,
      tags,
    })
  }

  /**
   * GET /support/agent/tickets/:ticket — Show ticket detail (agent view)
   */
  async show(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = ctx.auth.user!.id

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

    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    const tags = await Tag.query().select('id', 'name', 'color')

    const cannedResponses = await CannedResponse.query()
      .withScopes((scopes) => scopes.forAgent(userId))

    const macros = await Macro.query()
      .withScopes((scopes) => scopes.forAgent(userId))
      .orderBy('order')

    const isFollowing = await ticket.isFollowedBy(userId)
    const followersCount = await ticket.followersCount()

    return ctx.inertia.render('Escalated/Agent/TicketShow', {
      ticket,
      departments,
      tags,
      cannedResponses,
      macros,
      is_following: isFollowing,
      followers_count: followersCount,
    })
  }

  /**
   * PUT /support/agent/tickets/:ticket — Update ticket
   */
  async update(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const data = ctx.request.only(['subject', 'description', 'metadata'])

    await this.ticketService.update(ticket, data)

    ctx.session.flash('success', 'Ticket updated.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/reply — Reply to ticket
   */
  async reply(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { body } = ctx.request.only(['body'])
    const attachments = ctx.request.files('attachments')

    await this.ticketService.reply(ticket, user as any, body, attachments)

    ctx.session.flash('success', 'Reply sent.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/note — Add internal note
   */
  async note(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { body } = ctx.request.only(['body'])
    const attachments = ctx.request.files('attachments')

    await this.ticketService.addNote(ticket, user as any, body, attachments)

    ctx.session.flash('success', 'Note added.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/assign — Assign ticket
   */
  async assign(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { agent_id } = ctx.request.only(['agent_id'])

    await this.assignmentService.assign(ticket, Number(agent_id), user as any)

    ctx.session.flash('success', 'Ticket assigned.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/status — Change status
   */
  async status(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { status } = ctx.request.only(['status'])

    await this.ticketService.changeStatus(ticket, status as TicketStatus, user as any)

    ctx.session.flash('success', 'Status updated.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/priority — Change priority
   */
  async priority(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { priority } = ctx.request.only(['priority'])

    await this.ticketService.changePriority(ticket, priority as TicketPriority, user as any)

    ctx.session.flash('success', 'Priority updated.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/tags — Update tags
   */
  async tags(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { tag_ids } = ctx.request.only(['tag_ids'])
    const newTagIds = (tag_ids || []).map(Number)

    await ticket.load('tags')
    const currentTagIds = ticket.tags.map((t: Tag) => t.id)

    const toAdd = newTagIds.filter((id: number) => !currentTagIds.includes(id))
    const toRemove = currentTagIds.filter((id: number) => !newTagIds.includes(id))

    if (toAdd.length) await this.ticketService.addTags(ticket, toAdd, user as any)
    if (toRemove.length) await this.ticketService.removeTags(ticket, toRemove, user as any)

    ctx.session.flash('success', 'Tags updated.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/department — Change department
   */
  async department(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { department_id } = ctx.request.only(['department_id'])

    await this.ticketService.changeDepartment(ticket, Number(department_id), user as any)

    ctx.session.flash('success', 'Department updated.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/macro — Apply macro
   */
  async applyMacro(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { macro_id } = ctx.request.only(['macro_id'])

    const macro = await Macro.query()
      .withScopes((scopes) => scopes.forAgent(user.id))
      .where('id', macro_id)
      .firstOrFail()

    const macroService = new MacroService()
    await macroService.apply(macro, ticket, user as any)

    ctx.session.flash('success', `Macro "${macro.name}" applied.`)
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/follow — Toggle follow
   */
  async follow(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = ctx.auth.user!.id

    if (await ticket.isFollowedBy(userId)) {
      await ticket.unfollow(userId)
      ctx.session.flash('success', 'Unfollowed ticket.')
    } else {
      await ticket.follow(userId)
      ctx.session.flash('success', 'Following ticket.')
    }

    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/presence — Report presence
   */
  async presence(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = ctx.auth.user!.id
    const userName = (ctx.auth.user as any).name ?? (ctx.auth.user as any).fullName ?? 'Agent'

    // Use a simple in-memory store (in production, use Redis/cache)
    const presenceStore = (globalThis as any).__escalated_presence ?? {}
    const ticketKey = `ticket_${ticket.id}`

    if (!presenceStore[ticketKey]) {
      presenceStore[ticketKey] = {}
    }

    presenceStore[ticketKey][userId] = {
      id: userId,
      name: userName,
      timestamp: Date.now(),
    }

    // Clean up stale entries (older than 2 minutes)
    const cutoff = Date.now() - 120_000
    const viewers: any[] = []
    for (const [uid, data] of Object.entries(presenceStore[ticketKey])) {
      if ((data as any).timestamp < cutoff) {
        delete presenceStore[ticketKey][uid]
      } else if (Number(uid) !== userId) {
        viewers.push(data)
      }
    }

    ;(globalThis as any).__escalated_presence = presenceStore

    return ctx.response.json({ viewers })
  }

  /**
   * POST /support/agent/tickets/:ticket/replies/:replyId/pin — Toggle pin
   */
  async pin(ctx: HttpContext) {
    const replyId = ctx.params.reply || ctx.params.replyId
    const reply = await Reply.findOrFail(replyId)

    if (!reply.isInternalNote) {
      ctx.session.flash('error', 'Only internal notes can be pinned.')
      return ctx.response.redirect().back()
    }

    reply.isPinned = !reply.isPinned
    await reply.save()

    ctx.session.flash('success', reply.isPinned ? 'Note pinned.' : 'Note unpinned.')
    return ctx.response.redirect().back()
  }
}
