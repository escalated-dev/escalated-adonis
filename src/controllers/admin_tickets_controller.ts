import type { HttpContext } from '@adonisjs/core/http'
import type Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Department from '../models/department.js'
import Tag from '../models/tag.js'
import CannedResponse from '../models/canned_response.js'
import Macro from '../models/macro.js'
import ChatSession from '../models/chat_session.js'
import TicketService from '../services/ticket_service.js'
import AssignmentService from '../services/assignment_service.js'
import MacroService from '../services/macro_service.js'
import { getRenderer } from '../rendering/renderer.js'
import type { TicketStatus, TicketPriority } from '../types.js'
import { t } from '../support/i18n.js'

export default class AdminTicketsController {
  protected ticketService = new TicketService()
  protected assignmentService = new AssignmentService()

  /**
   * GET /support/admin/tickets — List all tickets (admin view)
   */
  async index(ctx: HttpContext) {
    const filters = ctx.request.only([
      'status',
      'priority',
      'ticket_type',
      'assigned_to',
      'unassigned',
      'department_id',
      'search',
      'sla_breached',
      'tag_ids',
      'sort_by',
      'sort_dir',
      'per_page',
      'following',
    ])

    const tickets = await this.ticketService.list(
      filters,
      filters.following ? (ctx.auth.user as any) : null
    )

    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    const tags = await Tag.query().select('id', 'name', 'color')
    const agents = await this.getAgents()

    return getRenderer().render(ctx, 'Escalated/Admin/Tickets/Index', {
      tickets,
      filters: ctx.request.all(),
      departments,
      tags,
      agents,
    })
  }

  /**
   * GET /support/admin/tickets/:ticket — Show ticket detail (admin view)
   */
  async show(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = ctx.auth.user!.id

    await ticket.load('department')
    await ticket.load('tags')
    await ticket.load('satisfactionRating')
    await ticket.load((loader: any) => {
      loader.load('replies', (query: any) => {
        query.preload('attachments').orderBy('created_at', 'desc')
      })
      loader.load('activities', (query: any) => {
        query.orderBy('created_at', 'desc').limit(20)
      })
    })

    // Resolve attachment URLs (url() is async on the Attachment model)
    for (const reply of ticket.replies ?? []) {
      for (const attachment of reply.attachments ?? []) {
        ;(attachment as any).$extras.url = await attachment.url()
      }
    }

    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    const tags = await Tag.query().select('id', 'name', 'color')

    const cannedResponses = await CannedResponse.query().withScopes((scopes) =>
      scopes.forAgent(userId)
    )

    const agents = await this.getAgents()

    const macros = await Macro.query()
      .withScopes((scopes) => scopes.forAgent(userId))
      .orderBy('order')

    const isFollowing = await ticket.isFollowedBy(userId)
    const followersCount = await ticket.followersCount()

    // Load associated chat session
    const chatSession = await ChatSession.query().where('ticket_id', ticket.id).first()

    // Chat messages are replies with type 'chat_message'
    const chatMessages = ticket.replies?.filter((r: any) => r.type === 'chat_message') ?? []

    // Count requester's total tickets
    const { default: TicketModel } = await import('../models/ticket.js')
    let requesterTicketCount = 0
    if (ticket.requesterId && ticket.requesterType) {
      const countResult = await TicketModel.query()
        .where('requester_type', ticket.requesterType)
        .where('requester_id', ticket.requesterId)
        .count('* as total')
        .first()
      requesterTicketCount = Number((countResult as any)?.$extras?.total ?? 0)
    }

    // Load related tickets via split metadata
    const relatedTickets = await this.loadRelatedTickets(ticket)

    return getRenderer().render(ctx, 'Escalated/Admin/Tickets/Show', {
      ticket,
      departments,
      tags,
      cannedResponses,
      agents,
      macros,
      is_following: isFollowing,
      followers_count: followersCount,
      chat_session_id: chatSession?.id ?? null,
      chat_started_at: chatSession?.createdAt?.toISO() ?? null,
      chat_messages: chatMessages.map((m: any) => ({
        id: m.id,
        body: m.body,
        author_type: m.authorType,
        author_id: m.authorId,
        created_at: m.createdAt.toISO(),
      })),
      chat_metadata: chatSession?.metadata ?? ticket.chatMetadata ?? null,
      requester_ticket_count: requesterTicketCount,
      related_tickets: relatedTickets,
    })
  }

  async reply(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { body } = ctx.request.only(['body'])
    const attachments = ctx.request.files('attachments')
    await this.ticketService.reply(ticket, user as any, body, attachments)
    ctx.session.flash('success', t('ticket.reply_sent'))
    return ctx.response.redirect().back()
  }

  async note(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { body } = ctx.request.only(['body'])
    const attachments = ctx.request.files('attachments')
    await this.ticketService.addNote(ticket, user as any, body, attachments)
    ctx.session.flash('success', t('ticket.note_added'))
    return ctx.response.redirect().back()
  }

  async assign(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { agent_id: agentId } = ctx.request.only(['agent_id'])
    await this.assignmentService.assign(ticket, Number(agentId), user as any)
    ctx.session.flash('success', t('ticket.assigned'))
    return ctx.response.redirect().back()
  }

  async status(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { status } = ctx.request.only(['status'])
    await this.ticketService.changeStatus(ticket, status as TicketStatus, user as any)
    ctx.session.flash('success', t('ticket.status_updated'))
    return ctx.response.redirect().back()
  }

  async priority(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { priority } = ctx.request.only(['priority'])
    await this.ticketService.changePriority(ticket, priority as TicketPriority, user as any)
    ctx.session.flash('success', t('ticket.priority_updated'))
    return ctx.response.redirect().back()
  }

  async tags(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { tag_ids: tagIds } = ctx.request.only(['tag_ids'])
    const newTagIds = (tagIds || []).map(Number)

    await ticket.load('tags')
    const currentTagIds = ticket.tags.map((tag: Tag) => tag.id)
    const toAdd = newTagIds.filter((id: number) => !currentTagIds.includes(id))
    const toRemove = currentTagIds.filter((id: number) => !newTagIds.includes(id))
    if (toAdd.length) await this.ticketService.addTags(ticket, toAdd, user as any)
    if (toRemove.length) await this.ticketService.removeTags(ticket, toRemove, user as any)
    ctx.session.flash('success', t('ticket.tags_updated'))
    return ctx.response.redirect().back()
  }

  async department(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { department_id: departmentId } = ctx.request.only(['department_id'])
    await this.ticketService.changeDepartment(ticket, Number(departmentId), user as any)
    ctx.session.flash('success', t('ticket.department_updated'))
    return ctx.response.redirect().back()
  }

  async applyMacro(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { macro_id: macroId } = ctx.request.only(['macro_id'])
    const macro = await Macro.query()
      .withScopes((scopes) => scopes.forAgent(user.id))
      .where('id', macroId)
      .firstOrFail()
    const macroService = new MacroService()
    await macroService.apply(macro, ticket, user as any)
    ctx.session.flash('success', t('ticket.macro_applied', { name: macro.name }))
    return ctx.response.redirect().back()
  }

  async follow(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = ctx.auth.user!.id
    if (await ticket.isFollowedBy(userId)) {
      await ticket.unfollow(userId)
      ctx.session.flash('success', t('ticket.unfollowed'))
    } else {
      await ticket.follow(userId)
      ctx.session.flash('success', t('ticket.following'))
    }
    return ctx.response.redirect().back()
  }

  async presence(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = ctx.auth.user!.id
    const userName = (ctx.auth.user as any).name ?? 'Admin'
    const presenceStore = (globalThis as any).__escalated_presence ?? {}
    const ticketKey = `ticket_${ticket.id}`
    if (!presenceStore[ticketKey]) presenceStore[ticketKey] = {}
    presenceStore[ticketKey][userId] = { id: userId, name: userName, timestamp: Date.now() }
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

  async pin(ctx: HttpContext) {
    const replyId = ctx.params.reply || ctx.params.replyId
    const reply = await Reply.findOrFail(replyId)
    if (!reply.isInternalNote) {
      ctx.session.flash('error', t('ticket.pin_notes_only'))
      return ctx.response.redirect().back()
    }
    reply.isPinned = !reply.isPinned
    await reply.save()
    ctx.session.flash(
      'success',
      reply.isPinned ? t('ticket.note_pinned') : t('ticket.note_unpinned')
    )
    return ctx.response.redirect().back()
  }

  /**
   * Load tickets related to the given ticket via split metadata.
   */
  protected async loadRelatedTickets(
    ticket: Ticket
  ): Promise<{ id: number; reference: string; subject: string; status: string }[]> {
    const { default: TicketModel } = await import('../models/ticket.js')
    const relatedIds: number[] = []
    const meta = ticket.metadata ?? {}

    if (meta.split_from_ticket_id) {
      relatedIds.push(Number(meta.split_from_ticket_id))
    }
    if (Array.isArray(meta.split_to_ticket_ids)) {
      relatedIds.push(...meta.split_to_ticket_ids.map(Number))
    }

    if (relatedIds.length === 0) return []

    const related = await TicketModel.query()
      .whereIn('id', relatedIds)
      .select('id', 'reference', 'subject', 'status')

    return related.map((linkedTicket: any) => ({
      id: linkedTicket.id,
      reference: linkedTicket.reference,
      subject: linkedTicket.subject,
      status: linkedTicket.status,
    }))
  }

  /**
   * Get all users who are agents or admins.
   */
  protected async getAgents(): Promise<{ id: number; name: string; email: string }[]> {
    const config = (globalThis as any).__escalated_config
    try {
      const userModelPath = config?.userModel ?? '#models/user'
      const { default: UserModel } = await import(userModelPath)
      const users = await UserModel.all()

      const agents: { id: number; name: string; email: string }[] = []
      for (const user of users) {
        const isAgent = config?.authorization?.isAgent
          ? await config.authorization.isAgent(user)
          : false
        const isAdmin = config?.authorization?.isAdmin
          ? await config.authorization.isAdmin(user)
          : false
        if (isAgent || isAdmin) {
          agents.push({
            id: user.id,
            name: user.name ?? user.fullName ?? '',
            email: user.email ?? '',
          })
        }
      }
      return agents
    } catch {
      return []
    }
  }
}
