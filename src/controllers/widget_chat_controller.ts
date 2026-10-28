import type { HttpContext } from '@adonisjs/core/http'
import ChatSessionService from '../services/chat_session_service.js'
import ChatAvailabilityService from '../services/chat_availability_service.js'
import ChatRoutingService from '../services/chat_routing_service.js'
import Reply from '../models/reply.js'
import type ChatSession from '../models/chat_session.js'
import { sanitizeWidgetMetadata } from '../support/widget_metadata.js'
import { WIDGET_ORIGIN } from '../support/widget_origins.js'
import { activeDepartmentId, isAgentReply } from '../support/widget_contract.js'
import { getConfig } from '../helpers/config.js'
import { resolveUserModel } from '../support/user_model.js'
import Ticket from '../models/ticket.js'
import {
  InvalidCode,
  consume,
  isValidEmail,
  markVerified,
  normalizeEmail,
  privateResponse,
} from '../support/guest_access.js'
import { proofErrors, validationError } from './guest_verification_controller.js'

/** Replies a chat transcript returns, newest kept when a chat runs longer. */
const TRANSCRIPT_LIMIT = 100

/** Name shown for an agent whose user record has no name. */
const AGENT_FALLBACK_NAME = 'Support'

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

    if (data.message !== undefined && data.message !== null && typeof data.message !== 'string') {
      return error(ctx, 'message must be text')
    }

    const hostMetadata = sanitizeWidgetMetadata(data.metadata, (ctx as any)[WIDGET_ORIGIN] ?? null)
    if (!hostMetadata.valid) {
      return error(ctx, hostMetadata.error)
    }
    const metadata = hostMetadata.metadata
    const departmentId = await activeDepartmentId(data.department_id)

    // A chat needs a `chat` code for the visitor's email (docs/guest-access.md).
    const email = normalizeEmail(data.email)
    const errors: Record<string, string> = {}
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address.'
    Object.assign(errors, proofErrors(ctx.request.all()))
    if (Object.keys(errors).length > 0) return validationError(ctx, errors)

    let started: Awaited<ReturnType<ChatSessionService['startChat']>>
    try {
      started = await consume(
        ctx.request.input('verification_id'),
        ctx.request.input('verification_code'),
        email,
        'chat',
        async () => {
          const result = await this.chatService.startChat({
            visitorName: data.name || undefined,
            visitorEmail: email,
            subject: data.subject || undefined,
            message: data.message ?? null,
            departmentId,
            metadata: metadata ?? undefined,
          })
          // The chat's ticket carries a proven address.
          const chatTicket = await Ticket.findOrFail(result.ticket.id)
          await markVerified(chatTicket, email)
          await chatTicket.save()
          return result
        }
      )
    } catch (failure) {
      if (failure instanceof InvalidCode) {
        return validationError(ctx, { verification_code: failure.message })
      }
      throw failure
    }
    const { ticket, session, visitorToken, visitorTokenExpiresAt, firstReply } = started

    // Attempt auto-assignment
    const agentId = await this.routingService.findAvailableAgent({
      ticketId: ticket.id,
      departmentId,
      metadata,
    })

    if (agentId) {
      await this.chatService.assignAgent(session.id, agentId)
    }

    const names = new AgentNames()
    const visitorName = guestName(session, ticket)

    privateResponse(ctx.response)
    return ctx.response.created({
      // The shared widget addresses the chat by `id` in every chat path. It is
      // the visitor token: random, and the only key the chat routes accept.
      id: visitorToken,
      session_id: session.id,
      ticket_reference: ticket.reference,
      visitor_token: visitorToken,
      // The token stops working after this; the visitor starts a new chat.
      expires_at: visitorTokenExpiresAt.toISO(),
      status: agentId ? 'active' : 'waiting',
      messages: firstReply ? [await serializeMessage(firstReply, session, visitorName, names)] : [],
      agent: agentId ? { name: await names.nameOf(agentId) } : null,
    })
  }

  /**
   * GET /widget/chat/:token/messages — The chat transcript the widget polls.
   */
  async messages(ctx: HttpContext) {
    const session = await this.chatService.findByVisitorToken(ctx.params.token)
    if (!session) {
      return notFound(ctx)
    }

    const replies = await Reply.query()
      .where('ticket_id', session.ticketId)
      .where('is_internal_note', false)
      .orderBy('id', 'desc')
      .limit(TRANSCRIPT_LIMIT)

    const names = new AgentNames()
    const visitorName = guestName(session, session.ticket)
    const messages = []
    for (const reply of replies.reverse()) {
      messages.push(await serializeMessage(reply, session, visitorName, names))
    }

    return ctx.response.json({
      messages,
      agent: session.agentId ? { name: await names.nameOf(session.agentId) } : null,
      // Agent typing is broadcast, not stored, so a polling widget sees none.
      typing: null,
      ended: isEnded(session),
    })
  }

  /**
   * POST /widget/chat/:token/messages — Send a message as a visitor (the
   * shared widget's path; `/:token/message` is the same action).
   */
  async storeMessage(ctx: HttpContext) {
    return this.message(ctx)
  }

  /**
   * POST /widget/chat/:token/message — Send a message as a visitor.
   */
  async message(ctx: HttpContext) {
    const { token } = ctx.params
    const { body } = ctx.request.only(['body'])

    const session = await this.chatService.findByVisitorToken(token)
    if (!session) {
      return notFound(ctx)
    }

    if (isEnded(session)) {
      return ended(ctx, 'Chat has ended.')
    }

    if (!body) {
      return error(ctx, 'body is required')
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
      return notFound(ctx)
    }

    if (isEnded(session)) {
      return ended(ctx, 'Chat has ended.')
    }

    // The shared widget posts no body: a call means "typing".
    const payload = this.chatService.updateTyping(
      session.id,
      session.visitorId ?? 0,
      isTyping === undefined ? true : !!isTyping
    )

    return ctx.response.json(payload)
  }

  /**
   * POST /widget/chat/:token/end — End a chat session from visitor side.
   */
  async end(ctx: HttpContext) {
    const { token } = ctx.params

    const session = await this.chatService.findByVisitorToken(token)
    if (!session) {
      return notFound(ctx)
    }

    if (isEnded(session)) {
      return ended(ctx, 'Chat has already ended.')
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

    const session = await this.chatService.findByVisitorToken(token)
    if (!session) {
      return notFound(ctx)
    }

    if (!isEnded(session)) {
      return ended(ctx, 'Chat must be ended before rating.')
    }

    if (!rating || rating < 1 || rating > 5) {
      return error(ctx, 'rating is required (1-5)')
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

/**
 * A refused request: `message` is what the shared widget shows, `error` what
 * earlier clients read.
 */
function error(ctx: HttpContext, message: string) {
  return ctx.response.badRequest({ message, error: message })
}

function isEnded(session: ChatSession) {
  return session.status === 'ended' || session.status === 'abandoned'
}

/** A chat that has ended (or has not, for `rate`): 422, as in escalated-laravel. */
function ended(ctx: HttpContext, message: string) {
  return ctx.response.unprocessableEntity({ message, error: message })
}

function notFound(ctx: HttpContext) {
  const message = 'Chat session not found'
  return ctx.response.notFound({ message, error: message })
}

/** The visitor's name as the transcript shows it. */
function guestName(
  session: ChatSession,
  ticket: { guestName?: string | null } | null | undefined
): string {
  return session.visitorName || ticket?.guestName || 'Visitor'
}

/** A chat message in the shape the shared widget renders. */
async function serializeMessage(
  reply: Reply,
  session: ChatSession,
  visitorName: string,
  names: AgentNames
) {
  const fromAgent = isAgentReply(reply, session)
  return {
    id: reply.id,
    body: reply.body,
    is_agent: fromAgent,
    author: { name: fromAgent ? await names.nameOf(reply.authorId) : visitorName },
    author_type: reply.authorType,
    created_at: reply.createdAt?.toISO() ?? null,
  }
}

/**
 * Looks agents' names up in the host's user model (`config.userModel`), once
 * per user per request.
 */
class AgentNames {
  protected cache = new Map<string, Promise<string>>()

  nameOf(userId: unknown): Promise<string> {
    const key = String(userId)
    let name = this.cache.get(key)
    if (!name) {
      name = this.lookup(userId)
      this.cache.set(key, name)
    }
    return name
  }

  protected async lookup(userId: unknown): Promise<string> {
    if (userId === null || userId === undefined) return AGENT_FALLBACK_NAME
    try {
      const UserModel = await resolveUserModel()
      const user = await UserModel.find(userId)
      const name = user?.name ?? user?.fullName ?? user?.full_name
      return typeof name === 'string' && name.trim() !== '' ? name : AGENT_FALLBACK_NAME
    } catch {
      return AGENT_FALLBACK_NAME
    }
  }
}
