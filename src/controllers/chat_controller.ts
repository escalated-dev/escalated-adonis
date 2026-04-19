import type { HttpContext } from '@adonisjs/core/http'
import ChatSessionService from '../services/chat_session_service.js'
import type ChatSession from '../models/chat_session.js'
import AgentProfile from '../models/agent_profile.js'
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
   * POST /agent/chats/:id/transfer — Transfer a chat to another agent.
   */
  async transfer(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const sessionId = ctx.params.id
    const { agent_id: newAgentId } = ctx.request.only(['agent_id'])

    if (!newAgentId) {
      return ctx.response.badRequest({ error: 'agent_id is required' })
    }

    const session = await this.chatService.transfer(sessionId, newAgentId, user)

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
