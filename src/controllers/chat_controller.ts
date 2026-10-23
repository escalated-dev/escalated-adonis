import type { HttpContext } from '@adonisjs/core/http'
import ChatSessionService from '../services/chat_session_service.js'
import ChatSession from '../models/chat_session.js'
import AgentProfile from '../models/agent_profile.js'
import Department from '../models/department.js'
import { DateTime } from 'luxon'
import { requireAuthUser } from '../support/auth_user.js'

/**
 * Agent-facing chat controller.
 *
 * All endpoints require agent authentication.
 */
export default class ChatController {
  protected chatService = new ChatSessionService()

  /**
   * GET /agent/chats — List active chats for the authenticated agent.
   */
  async index(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const chats = await this.chatService.getAgentChats(user.id)

    return ctx.response.json({
      chats: chats.map((c) => this.serializeSession(c)),
    })
  }

  /**
   * GET /agent/chats/queue — List chats waiting in queue.
   */
  async queue(ctx: HttpContext) {
    const departmentId = ctx.request.input('department_id')
    const chats = await this.chatService.getQueue(departmentId)

    return ctx.response.json({
      queue: chats.map((c) => this.serializeSession(c)),
    })
  }

  /**
   * POST /agent/chats/:id/accept — Accept a chat from the queue.
   */
  async accept(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const sessionId = ctx.params.id

    const session = await this.chatService.assignAgent(sessionId, user.id)

    return ctx.response.json({
      session: this.serializeSession(session),
    })
  }

  /**
   * POST /agent/chats/:id/end — End a chat session.
   */
  async end(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const sessionId = ctx.params.id

    const session = await this.chatService.endChat(sessionId, user)

    return ctx.response.json({
      session: this.serializeSession(session),
    })
  }

  /**
   * POST /admin/chat/:session/end (escalated.admin.chat.end) — End a chat from
   * the shared ticket view, answered as escalated-laravel answers it: 422 when
   * the chat already ended.
   */
  async endFromTicket(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const session = await ChatSession.findOrFail(ctx.params.session)

    if (session.status === 'ended') {
      return ctx.response.unprocessableEntity({ message: 'Chat is already ended.' })
    }

    const ended = await this.chatService.endChat(session.id, user)

    return ctx.response.json({
      message: 'Chat ended.',
      session: this.serializeSession(ended),
    })
  }

  /**
   * POST /agent/chats/:id/transfer — Transfer a chat to another agent and/or department.
   */
  async transfer(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const sessionId = ctx.params.id
    // {"agent_id", "department_id"} (either or both), as escalated-laravel's
    // ChatController::transfer reads it; the older {"type", "id"} is read too.
    const body = ctx.request.only(['agent_id', 'department_id', 'type', 'id'])
    const blank = (value: unknown) => value === undefined || value === null || value === ''
    let agentId = blank(body.agent_id) ? null : body.agent_id
    let departmentId = blank(body.department_id) ? null : body.department_id
    if (body.type === 'agent' && agentId === null && !blank(body.id)) agentId = body.id
    if (body.type === 'department' && departmentId === null && !blank(body.id))
      departmentId = body.id

    if (agentId === null && departmentId === null) {
      return ctx.response.badRequest({ error: 'Provide an agent_id or department_id.' })
    }

    let toDepartmentId: number | null = null
    if (departmentId !== null) {
      toDepartmentId = Number(departmentId)
      if (!Number.isInteger(toDepartmentId) || !(await Department.find(toDepartmentId))) {
        return ctx.response.unprocessableEntity({ error: 'The selected department_id is invalid.' })
      }
    }

    const session = await this.chatService.transfer(sessionId, agentId, user, {
      departmentId: toDepartmentId,
    })

    return ctx.response.json({
      session: this.serializeSession(session),
    })
  }

  /**
   * POST /agent/chats/status — Update the agent's chat availability status.
   */
  async updateStatus(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const { status } = ctx.request.only(['status'])

    if (!['online', 'away', 'offline'].includes(status)) {
      return ctx.response.badRequest({ error: 'Invalid status. Must be online, away, or offline.' })
    }

    let profile = await AgentProfile.query().where('user_id', user.id).first()

    if (!profile) {
      profile = await AgentProfile.create({
        userId: user.id,
        chatStatus: status,
        lastSeenAt: DateTime.now(),
      })
    } else {
      profile.chatStatus = status
      profile.lastSeenAt = DateTime.now()
      await profile.save()
    }

    return ctx.response.json({
      status: profile.chatStatus,
    })
  }

  /**
   * POST /agent/chats/:id/message — Send a message in a chat.
   */
  async message(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const sessionId = ctx.params.id
    const { body } = ctx.request.only(['body'])

    if (!body) {
      return ctx.response.badRequest({ error: 'body is required' })
    }

    const reply = await this.chatService.sendMessage(
      sessionId,
      { id: user.id, type: user.constructor.name },
      body
    )

    return ctx.response.json({
      message: {
        id: reply.id,
        body: reply.body,
        author_type: reply.authorType,
        author_id: reply.authorId,
        created_at: reply.createdAt?.toISO(),
      },
    })
  }

  /**
   * POST /agent/chats/:id/typing — Send a typing indicator.
   */
  async typing(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const sessionId = ctx.params.id
    const { is_typing: isTyping } = ctx.request.only(['is_typing'])

    const payload = this.chatService.updateTyping(sessionId, user.id, !!isTyping)

    return ctx.response.json(payload)
  }

  protected serializeSession(session: ChatSession): Record<string, any> {
    return {
      id: session.id,
      ticket_id: session.ticketId,
      agent_id: session.agentId,
      visitor_name: session.visitorName,
      visitor_email: session.visitorEmail,
      status: session.status,
      department_id: session.departmentId,
      messages_count: session.messagesCount,
      rating: session.rating,
      accepted_at: session.acceptedAt?.toISO() ?? null,
      ended_at: session.endedAt?.toISO() ?? null,
      last_activity_at: session.lastActivityAt?.toISO() ?? null,
      created_at: session.createdAt?.toISO(),
      ticket: session.$preloaded.ticket
        ? {
            id: session.ticket.id,
            reference: session.ticket.reference,
            subject: session.ticket.subject,
            status: session.ticket.status,
          }
        : undefined,
    }
  }
}
