import type { HttpContext } from '@adonisjs/core/http'
import { signAttachments } from '../support/attachment_access.js'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Department from '../models/department.js'
import Tag from '../models/tag.js'
import CannedResponse from '../models/canned_response.js'
import Macro from '../models/macro.js'
import ChatSession from '../models/chat_session.js'
import TicketService from '../services/ticket_service.js'
import CustomFieldService from '../services/custom_field_service.js'
import AssignmentService from '../services/assignment_service.js'
import MacroService from '../services/macro_service.js'
import TicketActionRegistry from '../services/ticket_action_registry.js'
import { getRenderer } from '../rendering/renderer.js'
import { getConfig } from '../helpers/config.js'
import type { TicketStatus, TicketPriority } from '../types.js'
import { t } from '../support/i18n.js'
import { requireAuthUser } from '../support/auth_user.js'
import TicketSubjectService from '../services/ticket_subject_service.js'
import AgentInbox from '../services/agent_inbox.js'
import { listFilterErrors } from '../support/ticket_list_filters.js'
import emitter from '@adonisjs/core/services/emitter'
import { ESCALATED_EVENTS } from '../events/index.js'
import { assignableAgents } from '../support/assignable_agents.js'
import type { RequesterTicketSummary } from '../models/ticket.js'

export default class AgentTicketsController {
  protected ticketService = new TicketService()
  protected customFields = new CustomFieldService()
  protected assignmentService = new AssignmentService()

  /**
   * GET /support/agent/tickets — List all tickets (agent view)
   */
  async index(ctx: HttpContext) {
    const requested = ctx.request.only([
      'status',
      'priority',
      'ticket_type',
      'assigned_to',
      'unassigned',
      'department_id',
      'account_type',
      'account_id',
      'search',
      'sla_breached',
      'tag_ids',
      'sort_by',
      'sort_dir',
      'per_page',
      'page',
      'following',
      'assigned',
      'sla_at_risk',
      'resolved_today',
      'open',
      'updated_within_hours',
      'view',
    ])

    const errors = listFilterErrors(requested)
    if (errors) {
      // escalated-laravel's $request->validate(): a JSON client gets a 422; a
      // page visit goes back with the errors for the next page's `errors` prop
      // (a raw 422 is what the Inertia client shows as an error modal).
      if (!ctx.request.header('x-inertia') && ctx.request.accepts(['html', 'json']) === 'json') {
        return ctx.response.status(422).json({ message: Object.values(errors)[0][0], errors })
      }
      ctx.session.flash(
        'errors',
        Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, messages[0]]))
      )
      // The referring page with its query (back() would drop the filters it
      // was showing), else the list.
      return ctx.response.redirect().toPath(ctx.request.getPreviousUrl([], ctx.request.url()))
    }

    const inbox = new AgentInbox(requireAuthUser(ctx.auth).id)
    const selected = inbox.normaliseFilters(requested)
    const queue = await inbox.queueFor(selected)
    inbox.remember((ctx as any).session, queue)
    const filters = inbox.listFilters(selected, queue)

    const tickets = await this.ticketService.list(
      filters,
      filters.following ? (ctx.auth.user as any) : null
    )
    await Ticket.withCustomStatuses(tickets.all())

    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    const tags = await Tag.query().select('id', 'name', 'color')

    return getRenderer().render(ctx, 'Escalated/Agent/TicketIndex', {
      tickets,
      filters: ctx.request.all(),
      departments,
      tags,
      queue: inbox.queueProp(queue),
      ...(await inbox.inboxProps(queue)),
    })
  }

  /**
   * GET /support/agent/tickets/:ticket — Show ticket detail (agent view)
   */
  async show(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = requireAuthUser(ctx.auth).id

    await Ticket.withCustomStatuses([ticket])
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

    // Short-lived links to the access-checked download route.
    await ticket.load('attachments')
    await signAttachments([ticket, ...(ticket.replies ?? [])])

    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    const tags = await Tag.query().select('id', 'name', 'color')

    const cannedResponses = await CannedResponse.query().withScopes((scopes) =>
      scopes.forAgent(userId)
    )

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

    ticket.$requesterTickets = await this.requesterTickets(ticket)
    const agents = await assignableAgents(ticket)

    const subjects = await new TicketSubjectService().serializeForTicket(ticket)

    const inbox = new AgentInbox(userId)
    const queue = await inbox.recalled((ctx as any).session)

    return getRenderer().render(ctx, 'Escalated/Agent/TicketShow', {
      ticket,
      subjects,
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
      custom_fields: await this.customFields.ticketValues(ticket.id),
      customActions: this.customActionsForTicket(ticket, ctx.auth.user),
      queue: inbox.queueProp(queue),
      ...(await inbox.inboxProps(queue)),
    })
  }

  /**
   * Serialize the visible custom actions for a ticket, adding url + method.
   */
  protected customActionsForTicket(ticket: Ticket, user: any): Array<Record<string, any>> {
    const prefix = getConfig().routes?.prefix ?? 'support'
    return new TicketActionRegistry().forTicket(ticket, user).map((action) => ({
      ...action,
      url: `/${prefix}/agent/tickets/${ticket.reference}/actions/${action.key}`,
      method: 'post',
    }))
  }

  /**
   * POST /support/agent/tickets/:ticket/actions/:action — Trigger a custom action
   */
  async customAction(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = requireAuthUser(ctx.auth)
    const actionKey = ctx.params.action

    const registry = new TicketActionRegistry()
    const action = registry.find(actionKey)

    if (!action || !action.visible(ticket, user)) {
      return ctx.response.notFound({ error: 'Custom action not found.' })
    }
    if (!action.enabled(ticket, user)) {
      return ctx.response.forbidden({ error: 'Custom action is not enabled.' })
    }

    const { payload } = ctx.request.only(['payload'])

    await emitter.emit(ESCALATED_EVENTS.TICKET_CUSTOM_ACTION_TRIGGERED, {
      ticket,
      action: action.key(),
      user,
      payload: payload ?? {},
      metadata: action.metadata(ticket, user),
    })

    ctx.session.flash('success', 'Custom action dispatched.')
    return ctx.response.redirect().back()
  }

  /**
   * PUT /support/agent/tickets/:ticket — Update ticket
   */
  async update(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const data = ctx.request.only(['subject', 'description', 'metadata'])

    // An omitted `custom_fields` changes nothing; sent keys are checked before
    // anything is written.
    const custom = await this.customFields.validateTicketInput(
      ctx.request.input('custom_fields'),
      'update'
    )
    if (Object.keys(custom.errors).length > 0) {
      ctx.session.flash('errors', custom.errors)
      return ctx.response.redirect().back()
    }

    await this.ticketService.update(ticket, data)
    await this.customFields.saveTicketValues(ticket.id, custom.values)

    ctx.session.flash('success', t('ticket.updated'))
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

    ctx.session.flash('success', t('ticket.reply_sent'))
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

    ctx.session.flash('success', t('ticket.note_added'))
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/assign — Assign ticket
   */
  async assign(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { agent_id: agentId } = ctx.request.only(['agent_id'])

    await this.assignmentService.assign(ticket, agentId, user as any)

    ctx.session.flash('success', t('ticket.assigned'))
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

    ctx.session.flash('success', t('ticket.status_updated'))
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

    ctx.session.flash('success', t('ticket.priority_updated'))
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/tags — Update tags
   */
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

  /**
   * POST /support/agent/tickets/:ticket/department — Change department
   */
  async department(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { department_id: departmentId } = ctx.request.only(['department_id'])

    await this.ticketService.changeDepartment(ticket, Number(departmentId), user as any)

    ctx.session.flash('success', t('ticket.department_updated'))
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/macro — Apply macro
   */
  async applyMacro(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = requireAuthUser(ctx.auth)
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

  /**
   * POST /support/agent/tickets/:ticket/follow — Toggle follow
   */
  async follow(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const userId = requireAuthUser(ctx.auth).id

    if (await ticket.isFollowedBy(userId)) {
      await ticket.unfollow(userId)
      ctx.session.flash('success', t('ticket.unfollowed'))
    } else {
      await ticket.follow(userId)
      ctx.session.flash('success', t('ticket.following'))
    }

    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/presence — Report presence
   */
  async presence(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = requireAuthUser(ctx.auth)
    const userId = user.id
    const userName = (user as any).name ?? (user as any).fullName ?? 'Agent'

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
      } else if (String(uid) !== String(userId)) {
        viewers.push(data)
      }
    }

    ;(globalThis as any).__escalated_presence = presenceStore

    return ctx.response.json({ viewers })
  }

  /**
   * POST /support/agent/tickets/:ticket/snooze — Snooze a ticket
   */
  async snooze(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { snoozed_until: snoozedUntil } = ctx.request.only(['snoozed_until'])

    const until = await this.snoozeUntil(snoozedUntil)
    if (!until) {
      ctx.session.flash('errors', {
        snoozed_until: 'The snooze time must be a date in the future.',
      })
      return ctx.response.redirect().back()
    }

    await this.ticketService.snoozeTicket(ticket, until, user as any)

    ctx.session.flash('success', t('ticket.snoozed'))
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/unsnooze — Unsnooze a ticket
   */
  async unsnooze(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!

    await this.ticketService.unsnoozeTicket(ticket, user as any)

    ctx.session.flash('success', t('ticket.unsnoozed'))
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/agent/tickets/:ticket/split — Split ticket from a reply
   */
  async split(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { reply_id: replyId } = ctx.request.only(['reply_id'])

    const newTicket = await this.ticketService.splitTicket(ticket, Number(replyId), user as any)

    ctx.session.flash('success', t('ticket.split_success', { reference: newTicket.reference }))
    return ctx.response.redirect().back()
  }

  /**
   * A snooze time: required, a date, and strictly in the future. Null otherwise.
   */
  protected async snoozeUntil(value: unknown) {
    if (typeof value !== 'string' || value.trim() === '') return null
    const { DateTime } = await import('luxon')
    let until = DateTime.fromISO(value.trim())
    if (!until.isValid) until = DateTime.fromSQL(value.trim())
    if (!until.isValid || until.toMillis() <= Date.now()) return null
    return until
  }

  /**
   * The requester's five most recent other tickets, newest first, matched as
   * the requester (or a guest's email) and through the ticket visibility scope
   * the request runs under.
   */
  protected async requesterTickets(ticket: Ticket): Promise<RequesterTicketSummary[]> {
    const query = Ticket.query().whereNot('id', ticket.id)

    if (ticket.isGuest) {
      if (!ticket.guestEmail) return []
      query.where('guest_email', ticket.guestEmail)
    } else if (ticket.requesterType && ticket.requesterId) {
      query.where('requester_type', ticket.requesterType).where('requester_id', ticket.requesterId)
    } else {
      return []
    }

    const others = await query
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(5)
      .select('id', 'reference', 'subject', 'status', 'created_at', 'updated_at')

    return others.map((other) => ({
      id: other.id,
      reference: other.reference,
      subject: other.subject,
      status: String(other.status),
      created_at: other.createdAt?.toISO() ?? null,
      updated_at: other.updatedAt?.toISO() ?? null,
    }))
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
   * POST /support/agent/tickets/:ticket/replies/:replyId/pin — Toggle pin
   */
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
}
