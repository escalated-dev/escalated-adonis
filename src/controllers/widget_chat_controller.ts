import type { HttpContext } from '@adonisjs/core/http'
import ChatSessionService from '../services/chat_session_service.js'
import ChatAvailabilityService from '../services/chat_availability_service.js'
import ChatRoutingService from '../services/chat_routing_service.js'
import Reply from '../models/reply.js'

/**
 * Public widget chat controller.
 *
 * These endpoints are unauthenticated and rate-limited. They power the
 * live chat widget for website visitors.
 */
export default class WidgetChatController {
  protected chatService = new ChatSessionService()
  protected availabilityService = new ChatAvailabilityService()
  protected routingService = new ChatRoutingService()

  /**
   * GET /widget/chat/availability — Check if live chat is available.
   */
  async availability(ctx: HttpContext) {
    const departmentId = ctx.request.input('department_id')
    const available = await this.availabilityService.isAvailable(departmentId)
    const queueLength = await this.availabilityService.queueLength(departmentId)

    return ctx.response.json({
      available,
      queue_length: queueLength,
    })
  }

  /**
   * POST /widget/chat/start — Start a new chat session.
   */
  async start(ctx: HttpContext) {
    const data = ctx.request.only([
      'name',
      'email',
      'message',
      'subject',
      'department_id',
      'metadata',
    ])

    if (!data.message) {
      return ctx.response.badRequest({ error: 'message is required' })
    }

    const { ticket, session, visitorToken } = await this.chatService.startChat({
      visitorName: data.name || undefined,
      visitorEmail: data.email || undefined,
      subject: data.subject || undefined,
      message: data.message,
      departmentId: data.department_id || undefined,
      metadata: data.metadata || undefined,
    })

    // Attempt auto-assignment
    const agentId = await this.routingService.findAvailableAgent({
      departmentId: data.department_id || null,
      metadata: data.metadata || null,
    })

    if (agentId) {
      await this.chatService.assignAgent(session.id, agentId)
    }

    return ctx.response.created({
      session_id: session.id,
      ticket_reference: ticket.reference,
      visitor_token: visitorToken,
      status: agentId ? 'active' : 'waiting',
    })
  }

  /**
   * POST /widget/chat/:token/message — Send a message as a visitor.
   */
  async message(ctx: HttpContext) {
    const { token } = ctx.params
    const { body } = ctx.request.only(['body'])

    if (!body) {
      return ctx.response.badRequest({ error: 'body is required' })
    }

    const session = await this.chatService.findByVisitorToken(token)
    if (!session) {
      return ctx.response.notFound({ error: 'Chat session not found' })
    }

    if (session.status === 'ended' || session.status === 'abandoned') {
      return ctx.response.badRequest({ error: 'Chat session has ended' })
    }

    const reply = await this.chatService.sendMessage(
      session.id,
      {
        id: session.visitorId ?? 0,
        type: session.visitorId ? 'User' : 'Guest',
      },
      body
    )

    return ctx.response.json({
      message: {
        id: reply.id,
        body: reply.body,
        author_type: reply.authorType,
        created_at: reply.createdAt?.toISO(),
      },
    })
  }

  /**
   * POST /widget/chat/:token/typing — Send typing indicator from visitor.
   */
  async typing(ctx: HttpContext) {
    const { token } = ctx.params
    const { is_typing: isTyping } = ctx.request.only(['is_typing'])

    const session = await this.chatService.findByVisitorToken(token)
    if (!session) {
      return ctx.response.notFound({ error: 'Chat session not found' })
    }

    const payload = this.chatService.updateTyping(session.id, session.visitorId ?? 0, !!isTyping)

    return ctx.response.json(payload)
  }

  /**
   * POST /widget/chat/:token/end — End a chat session from visitor side.
   */
  async end(ctx: HttpContext) {
    const { token } = ctx.params

    const session = await this.chatService.findByVisitorToken(token)
    if (!session) {
      return ctx.response.notFound({ error: 'Chat session not found' })
    }

    if (session.status === 'ended') {
      return ctx.response.badRequest({ error: 'Chat session already ended' })
    }

    await this.chatService.endChat(session.id)

    return ctx.response.json({ status: 'ended' })
  }

  /**
   * POST /widget/chat/:token/rate — Rate a completed chat session.
   */
  async rate(ctx: HttpContext) {
    const { token } = ctx.params
    const { rating, comment } = ctx.request.only(['rating', 'comment'])

    if (!rating || rating < 1 || rating > 5) {
      return ctx.response.badRequest({ error: 'rating is required (1-5)' })
    }

    const session = await this.chatService.findByVisitorToken(token)
    if (!session) {
      return ctx.response.notFound({ error: 'Chat session not found' })
    }

    await this.chatService.rateChat(session.id, rating, comment)

    // Also load messages for context
    const messages = await Reply.query()
      .where('ticket_id', session.ticketId)
      .where('is_internal_note', false)
      .orderBy('created_at', 'asc')

    return ctx.response.json({
      rated: true,
      session_id: session.id,
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        author_type: m.authorType,
        created_at: m.createdAt?.toISO(),
      })),
    })
  }
}
