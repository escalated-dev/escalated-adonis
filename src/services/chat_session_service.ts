import { agentCanAccessTicket } from '../support/ticket_access.js'
import { DateTime } from 'luxon'
import { createHash, randomBytes } from 'node:crypto'
import { grantTtlMinutes } from '../support/guest_access.js'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import ChatSession from '../models/chat_session.js'
import ChatRoutingService from './chat_routing_service.js'
import type { ChatSessionStatus } from '../models/chat_session.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import type { TicketStatus } from '../types.js'
import type { UserId } from '../helpers/user_id_column.js'

/** Chat tokens are stored as their SHA-256, like guest grants. */
export function hashVisitorToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Chat tokens live as long as guest grants (`guestAccess.ttlMinutes`), as in escalated-laravel. */
function visitorTokenExpiry(): DateTime {
  return DateTime.now().plus({ minutes: grantTtlMinutes() }).startOf('second')
}

export default class ChatSessionService {
  /**
   * Start a new chat session, creating a ticket with channel='chat'.
   *
   * The opening message is optional: without one the chat starts empty and
   * the visitor writes first through the message route.
   */
  async startChat(data: {
    visitorName?: string
    visitorEmail?: string
    visitorId?: number
    subject?: string
    message?: string | null
    departmentId?: number | null
    metadata?: Record<string, any>
  }): Promise<{
    ticket: Ticket
    session: ChatSession
    visitorToken: string
    visitorTokenExpiresAt: DateTime
    firstReply: Reply | null
  }> {
    const message =
      typeof data.message === 'string' && data.message.trim() !== '' ? data.message : ''
    // The visitor's only key to this chat: random, expiring, stored hashed.
    const visitorToken = randomBytes(32).toString('hex')
    const visitorTokenExpiresAt = visitorTokenExpiry()
    const reference = await Ticket.generateReference()

    const ticket = await Ticket.create({
      reference,
      requesterType: data.visitorId ? 'User' : null,
      requesterId: data.visitorId ?? null,
      guestName: data.visitorName ?? null,
      guestEmail: data.visitorEmail ?? null,
      guestToken: null,
      subject: data.subject || 'Live Chat',
      description: message,
      status: 'open' as TicketStatus,
      priority: 'medium',
      ticketType: 'question',
      channel: 'chat',
      departmentId: data.departmentId ?? null,
      metadata: { source: 'live_chat' },
      chatMetadata: data.metadata ?? null,
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    const session = await ChatSession.create({
      ticketId: ticket.id,
      visitorId: data.visitorId ?? null,
      visitorName: data.visitorName ?? null,
      visitorEmail: data.visitorEmail ?? null,
      visitorToken: hashVisitorToken(visitorToken),
      visitorTokenExpiresAt,
      status: 'waiting' as ChatSessionStatus,
      departmentId: data.departmentId ?? null,
      messagesCount: message ? 1 : 0,
      lastActivityAt: DateTime.now(),
      metadata: data.metadata ?? null,
    })

    // Store the opening message, if any, as a reply
    const firstReply = message
      ? await Reply.create({
          ticketId: ticket.id,
          authorType: data.visitorId ? 'User' : null,
          authorId: data.visitorId ?? null,
          body: message,
          isInternalNote: false,
          isPinned: false,
          type: 'chat_message',
        })
      : null

    await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })
    await emitter.emit(ESCALATED_EVENTS.CHAT_STARTED, { ticket, sessionId: session.id })

    return { ticket, session, visitorToken, visitorTokenExpiresAt, firstReply }
  }

  /**
   * Assign an agent to a chat session.
   */
  async assignAgent(sessionId: number, agentId: UserId): Promise<ChatSession> {
    const session = await ChatSession.findOrFail(sessionId)
    if (!(await agentCanAccessTicket(agentId, { id: session.ticketId })))
      throw Object.assign(new Error('Agent cannot access this ticket'), { status: 403 })
    session.agentId = agentId
    session.status = 'active'
    session.acceptedAt = DateTime.now()
    session.lastActivityAt = DateTime.now()
    await session.save()

    // Also assign the ticket
    const ticket = await Ticket.findOrFail(session.ticketId)
    ticket.assignedTo = agentId
    ticket.status = 'in_progress'
    ticket.ticketStatusId = null
    await ticket.save()

    await emitter.emit(ESCALATED_EVENTS.TICKET_ASSIGNED, {
      ticket,
      agentId,
    })
    await emitter.emit(ESCALATED_EVENTS.CHAT_ASSIGNED, { ticket, sessionId: session.id, agentId })

    return session.refresh()
  }

  /**
   * End a chat session.
   */
  async endChat(sessionId: number, causer?: any): Promise<ChatSession> {
    const session = await ChatSession.findOrFail(sessionId)
    session.status = 'ended'
    session.endedAt = DateTime.now()
    await session.save()

    const ticket = await Ticket.findOrFail(session.ticketId)
    ticket.chatEndedAt = DateTime.now()
    ticket.status = 'resolved'
    ticket.ticketStatusId = null
    ticket.resolvedAt = DateTime.now()
    await ticket.save()

    await emitter.emit(ESCALATED_EVENTS.TICKET_RESOLVED, { ticket, causer })
    await emitter.emit(ESCALATED_EVENTS.CHAT_ENDED, { ticket, sessionId: session.id, causer })

    return session.refresh()
  }

  /**
   * Transfer a chat to another agent and/or department.
   */
  async transfer(
    sessionId: number,
    newAgentId: UserId | null,
    _causer?: any,
    options: { departmentId?: number | null } = {}
  ): Promise<ChatSession> {
    const session = await ChatSession.findOrFail(sessionId)
    const previousAgentId = session.agentId
    const toAgentId = newAgentId === undefined || newAgentId === '' ? null : newAgentId
    const toDepartmentId = options.departmentId ?? null

    if (toAgentId === null && toDepartmentId === null)
      throw Object.assign(new Error('Provide an agent or a department'), { status: 400 })
    if (toAgentId !== null && !(await agentCanAccessTicket(toAgentId, { id: session.ticketId })))
      throw Object.assign(new Error('Agent cannot access this ticket'), { status: 403 })

    // As escalated-laravel's ChatSessionService::transferChat: an agent takes
    // the chat and its ticket; a department takes the ticket, and without an
    // agent the chat goes back to the queue and is routed again.
    const ticket = await Ticket.findOrFail(session.ticketId)
    if (toDepartmentId !== null) {
      ticket.departmentId = toDepartmentId
      session.departmentId = toDepartmentId
    }
    if (toAgentId !== null) {
      session.agentId = toAgentId
      ticket.assignedTo = toAgentId
    } else {
      session.agentId = null
      session.status = 'waiting'
      ticket.assignedTo = null
    }
    session.lastActivityAt = DateTime.now()
    await session.save()
    await ticket.save()

    if (toAgentId !== null) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_ASSIGNED, {
        ticket,
        agentId: toAgentId,
      })
    }

    if (previousAgentId) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_UNASSIGNED, {
        ticket,
        previousAgentId,
      })
    }

    await emitter.emit(ESCALATED_EVENTS.CHAT_TRANSFERRED, {
      ticket,
      sessionId: session.id,
      fromAgentId: previousAgentId ?? null,
      toAgentId,
      toDepartmentId,
    })

    if (toAgentId === null) {
      const routed = await new ChatRoutingService().findAvailableAgent({
        ticketId: ticket.id,
        departmentId: toDepartmentId,
      })
      if (routed) await this.assignAgent(session.id, routed)
    }

    return session.refresh()
  }

  /**
   * Send a chat message (creates a reply on the ticket).
   */
  async sendMessage(
    sessionId: number,
    author: { id: number; type: string },
    body: string
  ): Promise<Reply> {
    const session = await ChatSession.findOrFail(sessionId)
    session.messagesCount = (session.messagesCount || 0) + 1
    session.lastActivityAt = DateTime.now()
    await session.save()

    const reply = await Reply.create({
      ticketId: session.ticketId,
      authorType: author.type,
      authorId: author.id,
      body,
      isInternalNote: false,
      isPinned: false,
      type: 'chat_message',
    })

    await emitter.emit(ESCALATED_EVENTS.REPLY_CREATED, { reply })
    await emitter.emit(ESCALATED_EVENTS.CHAT_MESSAGE, {
      ticketId: session.ticketId,
      sessionId: session.id,
      replyId: reply.id,
      authorType: author.type ?? null,
      authorId: author.id ?? null,
      body,
    })

    return reply.refresh()
  }

  /**
   * Update typing indicator for a chat session.
   * Returns the channel to broadcast to and the typing state.
   */
  updateTyping(
    sessionId: number,
    userId: UserId,
    isTyping: boolean
  ): { channel: string; event: string; data: Record<string, any> } {
    return {
      channel: `escalated.chat.${sessionId}`,
      event: 'chat.typing',
      data: {
        session_id: sessionId,
        user_id: userId,
        is_typing: isTyping,
      },
    }
  }

  /**
   * Rate a chat session.
   */
  async rateChat(sessionId: number, rating: number, comment?: string): Promise<ChatSession> {
    const session = await ChatSession.findOrFail(sessionId)
    session.rating = Math.min(5, Math.max(1, rating))
    session.ratingComment = comment ?? null
    await session.save()

    return session.refresh()
  }

  /**
   * Get active chat sessions for an agent.
   */
  async getAgentChats(agentId: UserId): Promise<ChatSession[]> {
    return ChatSession.query()
      .where('agent_id', agentId)
      .where('status', 'active')
      .preload('ticket')
      .orderBy('last_activity_at', 'desc')
  }

  /**
   * Get the chat queue (waiting sessions).
   */
  async getQueue(departmentId?: number): Promise<ChatSession[]> {
    const query = ChatSession.query()
      .where('status', 'waiting')
      .preload('ticket')
      .orderBy('created_at', 'asc')

    if (departmentId) {
      query.where('department_id', departmentId)
    }

    return query
  }

  /**
   * The chat a visitor's unexpired token unlocks, or null (answered with 404).
   * A chat started before tokens were hashed holds its plain token and no
   * expiry: the first request with it stores the hash and gives it a full
   * lifetime, so chats in progress during an upgrade keep working.
   */
  async findByVisitorToken(token: unknown): Promise<ChatSession | null> {
    if (typeof token !== 'string' || token === '' || token.length > 255) return null
    let session = await ChatSession.query()
      .where('visitor_token', hashVisitorToken(token))
      .preload('ticket')
      .first()
    if (!session) {
      session = await ChatSession.query()
        .where('visitor_token', token)
        .whereNull('visitor_token_expires_at')
        .preload('ticket')
        .first()
      if (!session) return null
      session.visitorToken = hashVisitorToken(token)
    }
    if (!session.visitorTokenExpiresAt) {
      session.visitorTokenExpiresAt = visitorTokenExpiry()
      await session.save()
    }
    return session.visitorTokenExpiresAt > DateTime.now() ? session : null
  }
}
