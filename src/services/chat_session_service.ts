import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import ChatSession from '../models/chat_session.js'
import type { ChatSessionStatus } from '../models/chat_session.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import type { TicketStatus } from '../types.js'

export default class ChatSessionService {
  /**
   * Start a new chat session, creating a ticket with channel='chat'.
   */
  async startChat(data: {
    visitorName?: string
    visitorEmail?: string
    visitorId?: number
    subject?: string
    message: string
    departmentId?: number | null
    metadata?: Record<string, any>
  }): Promise<{ ticket: Ticket; session: ChatSession; visitorToken: string }> {
    const { randomBytes } = await import('node:crypto')
    const visitorToken = randomBytes(32).toString('hex')
    const reference = await Ticket.generateReference()

    const ticket = await Ticket.create({
      reference,
      requesterType: data.visitorId ? 'User' : null,
      requesterId: data.visitorId ?? null,
      guestName: data.visitorName ?? null,
      guestEmail: data.visitorEmail ?? null,
      guestToken: data.visitorId ? null : visitorToken,
      subject: data.subject || 'Live Chat',
      description: data.message,
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
      visitorToken,
      status: 'waiting' as ChatSessionStatus,
      departmentId: data.departmentId ?? null,
      messagesCount: 1,
      lastActivityAt: DateTime.now(),
      metadata: data.metadata ?? null,
    })

    // Store initial message as a reply
    await Reply.create({
      ticketId: ticket.id,
      authorType: data.visitorId ? 'User' : null,
      authorId: data.visitorId ?? null,
      body: data.message,
      isInternalNote: false,
      isPinned: false,
      type: 'chat_message',
    })

    await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })

    return { ticket, session, visitorToken }
  }

  /**
   * Assign an agent to a chat session.
   */
  async assignAgent(sessionId: number, agentId: number): Promise<ChatSession> {
    const session = await ChatSession.findOrFail(sessionId)
    session.agentId = agentId
    session.status = 'active'
    session.acceptedAt = DateTime.now()
    session.lastActivityAt = DateTime.now()
    await session.save()

    // Also assign the ticket
    const ticket = await Ticket.findOrFail(session.ticketId)
    ticket.assignedTo = agentId
    ticket.status = 'in_progress'
    await ticket.save()

    await emitter.emit(ESCALATED_EVENTS.TICKET_ASSIGNED, {
      ticket,
      agentId,
    })

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
    ticket.resolvedAt = DateTime.now()
    await ticket.save()

    await emitter.emit(ESCALATED_EVENTS.TICKET_RESOLVED, { ticket, causer })

    return session.refresh()
  }

  /**
   * Transfer a chat to another agent.
   */
  async transfer(sessionId: number, newAgentId: number, _causer?: any): Promise<ChatSession> {
    const session = await ChatSession.findOrFail(sessionId)
    const previousAgentId = session.agentId

    session.agentId = newAgentId
    session.lastActivityAt = DateTime.now()
    await session.save()

    const ticket = await Ticket.findOrFail(session.ticketId)
    ticket.assignedTo = newAgentId
    await ticket.save()

    await emitter.emit(ESCALATED_EVENTS.TICKET_ASSIGNED, {
      ticket,
      agentId: newAgentId,
    })

    if (previousAgentId) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_UNASSIGNED, {
        ticket,
        previousAgentId,
      })
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

    return reply.refresh()
  }

  /**
   * Update typing indicator for a chat session.
   * Returns the channel to broadcast to and the typing state.
   */
  updateTyping(
    sessionId: number,
    userId: number,
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
  async getAgentChats(agentId: number): Promise<ChatSession[]> {
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
   * Find a session by visitor token.
   */
  async findByVisitorToken(token: string): Promise<ChatSession | null> {
    return ChatSession.query().where('visitor_token', token).preload('ticket').first()
  }
}
