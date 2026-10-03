import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Contact from '../models/contact.js'
import InboundEmail from '../models/inbound_email.js'
import Attachment from '../models/attachment.js'
import EscalatedSetting from '../models/escalated_setting.js'
import TicketService from './ticket_service.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import { verifyReplyTo } from './email/message_id_util.js'
import { BLOCKED_EXTENSIONS, ALLOWED_HTML_TAGS, type InboundMessage } from '../types.js'

export default class InboundEmailService {
  constructor(protected ticketService: TicketService = new TicketService()) {}

  /**
   * Process a normalized inbound email message.
   */
  async process(message: InboundMessage, adapter: string = 'unknown'): Promise<InboundEmail> {
    // 1. Log the inbound email
    const inboundEmail = await this.logInboundEmail(message, adapter)

    try {
      // Skip SNS subscription confirmations
      if (message.fromEmail === 'sns-confirmation@amazonaws.com') {
        await inboundEmail.markProcessed()
        return inboundEmail
      }

      // Check for duplicate message ID
      if (message.messageId && (await this.isDuplicate(message.messageId, inboundEmail.id))) {
        await inboundEmail.markProcessed()
        return inboundEmail
      }

      // 2. Check if this is a reply to an existing ticket. A thread
      // match alone is not enough: the sender must also be the ticket's
      // requester, and the author is always taken from the ticket, never
      // from the unauthenticated From header.
      const existingTicket = await this.findTicketByEmail(message)
      const author = existingTicket ? await this.resolveReplyAuthor(existingTicket, message) : false

      if (existingTicket && author !== false) {
        // 3. Reply to existing ticket as its requester
        const reply = await this.addReplyToTicket(existingTicket, message, author)
        await inboundEmail.markProcessed(existingTicket.id, reply.id)
      } else {
        // 4. Create new ticket (also for a sender who is not the requester)
        const user = await this.findUserByEmail(message.fromEmail)
        const ticket = await this.createNewTicket(message, user)
        await inboundEmail.markProcessed(ticket.id)
      }

      return inboundEmail
    } catch (error: any) {
      await inboundEmail.markFailed(error.message)
      return inboundEmail
    }
  }

  /**
   * Find an existing ticket this email is replying to.
   *
   * Ticket references and Message-IDs are guessable, so once an inbound
   * reply secret is configured (`inboundEmail.replySecret`, which outbound
   * mail uses to sign `reply+{id}.{hmac8}@domain`) only that signed
   * recipient address is accepted. Without a secret, the subject reference
   * and In-Reply-To / References lookups are used, and
   * {@link resolveReplyAuthor} still requires the sender to be the
   * ticket's requester.
   */
  protected async findTicketByEmail(message: InboundMessage): Promise<Ticket | null> {
    const secret = this.replySecret()
    if (secret) {
      const ticketId = verifyReplyTo(message.toEmail, secret)
      return ticketId !== null ? Ticket.find(ticketId) : null
    }

    // Check subject for reference pattern
    const prefix = await EscalatedSetting.get('ticket_reference_prefix', 'ESC')
    const pattern = new RegExp(`\\[(${prefix!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+)\\]`)
    const match = message.subject.match(pattern)

    if (match) {
      const ticket = await Ticket.query().where('reference', match[1]).first()
      if (ticket) return ticket
    }

    // Check In-Reply-To and References headers
    const headerMessageIds: string[] = []

    if (message.inReplyTo) {
      headerMessageIds.push(message.inReplyTo)
    }

    if (message.references) {
      const refs = message.references.split(/\s+/)
      headerMessageIds.push(...refs)
    }

    if (headerMessageIds.length > 0) {
      const relatedEmail = await InboundEmail.query()
        .whereIn('message_id', headerMessageIds)
        .whereNotNull('ticket_id')
        .where('status', 'processed')
        .orderBy('id', 'desc')
        .first()

      if (relatedEmail && relatedEmail.ticketId) {
        return Ticket.find(relatedEmail.ticketId)
      }
    }

    return null
  }

  /**
   * Decide who a threaded inbound email may post as.
   *
   * Returns the requester (a host user, or null for a guest reply) when the
   * From address is the ticket's guest email or its requester's email,
   * compared case-insensitively, and false when the sender is anyone else.
   * Staff identity is never derived from the From header: an agent replying
   * by email is not the requester, so the message becomes a new ticket.
   */
  protected async resolveReplyAuthor(ticket: Ticket, message: InboundMessage): Promise<any> {
    const sender = this.normalizeEmail(message.fromEmail)
    if (!sender) return false

    if (ticket.guestEmail && this.normalizeEmail(ticket.guestEmail) === sender) {
      return null
    }

    if (ticket.requesterType && ticket.requesterId !== null && ticket.requesterId !== undefined) {
      const requester = await this.findRequester(ticket)
      if (requester && this.normalizeEmail(requester.email) === sender) {
        return requester
      }
    }

    return false
  }

  /**
   * Load the ticket's requester from the configured user model.
   */
  protected async findRequester(ticket: Ticket): Promise<any | null> {
    try {
      const config = (globalThis as any).__escalated_config
      const userModelPath = config?.userModel ?? '#models/user'
      const { default: UserModel } = await import(userModelPath)
      const user = await UserModel.find(ticket.requesterId)
      if (!user || user.constructor?.name !== ticket.requesterType) return null
      return user
    } catch {
      return null
    }
  }

  protected normalizeEmail(email: unknown): string {
    return typeof email === 'string' ? email.trim().toLowerCase() : ''
  }

  protected replySecret(): string {
    const config = (globalThis as any).__escalated_config
    const secret = config?.inboundEmail?.replySecret
    return typeof secret === 'string' ? secret : ''
  }

  /**
   * Find a user by email address using the configured user model.
   */
  protected async findUserByEmail(email: string): Promise<any | null> {
    try {
      const config = (globalThis as any).__escalated_config
      const userModelPath = config?.userModel ?? '#models/user'
      const { default: UserModel } = await import(userModelPath)
      const user = await UserModel.query().where('email', email).first()
      return user
    } catch {
      return null
    }
  }

  /**
   * Add a reply to an existing ticket from an inbound email.
   */
  protected async addReplyToTicket(
    ticket: Ticket,
    message: InboundMessage,
    user: any
  ): Promise<Reply> {
    const body = this.getSanitizedBody(message)

    let reply: Reply

    if (user) {
      reply = await this.ticketService.reply(ticket, user, body)
    } else {
      // Guest reply
      reply = await Reply.create({
        ticketId: ticket.id,
        authorType: null,
        authorId: null,
        body,
        isInternalNote: false,
        isPinned: false,
        type: 'reply',
      })

      const followerUserIds = await ticket.followerUserIds()
      await emitter.emit(ESCALATED_EVENTS.REPLY_CREATED, { reply, followerUserIds })
    }

    // Handle attachments
    await this.storeInboundAttachments(reply, message.attachments)

    // Reopen if resolved/closed
    if (['resolved', 'closed'].includes(ticket.status)) {
      try {
        await this.ticketService.reopen(ticket, user)
      } catch {
        // Status transition not allowed
      }
    }

    return reply
  }

  /**
   * Create a new ticket from an inbound email.
   */
  protected async createNewTicket(message: InboundMessage, user: any): Promise<Ticket> {
    const body = this.getSanitizedBody(message)

    if (user) {
      return this.ticketService.create(user, {
        subject: this.sanitizeSubject(message.subject),
        description: body,
        priority: 'medium',
        channel: 'email',
      })
    }

    // Guest ticket — apply the admin-configured guest policy. Same
    // helper used by WidgetController#createTicket (see #52).
    const { default: stringHelper } = await import('@adonisjs/core/helpers/string')
    const { resolveGuestPolicy } = await import('../helpers/guest_policy.js')
    const policy = await resolveGuestPolicy()

    // Dedupe inbound senders into a Contact (Pattern B).
    const guestName = message.fromName || this.nameFromEmail(message.fromEmail)
    const contact = await Contact.findOrCreateByEmail(message.fromEmail, guestName)

    const ticket = await Ticket.create({
      reference: await Ticket.generateReference(),
      requesterType: policy.requesterType,
      requesterId: policy.requesterId,
      guestName,
      guestEmail: message.fromEmail,
      guestToken: stringHelper.random(64),
      contactId: contact.id,
      subject: this.sanitizeSubject(message.subject),
      description: body,
      status: 'open',
      priority: 'medium',
      channel: 'email',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    await this.storeInboundAttachments(ticket, message.attachments)

    await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })

    return ticket
  }

  /**
   * Log the inbound email.
   */
  protected async logInboundEmail(message: InboundMessage, adapter: string): Promise<InboundEmail> {
    return InboundEmail.create({
      messageId: message.messageId ?? null,
      fromEmail: message.fromEmail,
      fromName: message.fromName ?? null,
      toEmail: message.toEmail,
      subject: message.subject,
      bodyText: message.bodyText ?? null,
      bodyHtml: message.bodyHtml ? this.sanitizeHtml(message.bodyHtml) : null,
      rawHeaders: message.rawHeaders ? JSON.stringify(message.rawHeaders) : null,
      status: 'pending',
      adapter,
    })
  }

  /**
   * Check for duplicate message ID.
   */
  protected async isDuplicate(messageId: string, excludeId: number): Promise<boolean> {
    const existing = await InboundEmail.query()
      .where('message_id', messageId)
      .whereNot('id', excludeId)
      .where('status', 'processed')
      .first()
    return !!existing
  }

  /**
   * Store inbound email attachments.
   */
  protected async storeInboundAttachments(
    attachable: { id: number; constructor: { name: string } },
    attachments: InboundMessage['attachments']
  ): Promise<void> {
    if (!attachments || attachments.length === 0) return

    const config = (globalThis as any).__escalated_config
    const disk = config?.storage?.disk ?? 'public'
    const basePath = config?.storage?.path ?? 'escalated/attachments'
    const maxSize = (config?.tickets?.maxAttachmentSizeKb ?? 10240) * 1024
    const maxCount = config?.tickets?.maxAttachmentsPerReply ?? 5

    let stored = 0

    for (const attachment of attachments) {
      if (stored >= maxCount) break

      const size =
        attachment.size ||
        (typeof attachment.content === 'string'
          ? attachment.content.length
          : (attachment.content as Buffer).length)

      if (size > maxSize) continue

      const extension =
        extname(attachment.filename || '')
          .slice(1)
          .toLowerCase() || 'bin'

      if (BLOCKED_EXTENSIONS.includes(extension)) continue

      const filename = `${randomUUID()}.${extension}`
      const path = `${basePath}/${filename}`

      try {
        const { default: drive } = await import('@adonisjs/drive/services/main')
        await drive
          .use(disk as any)
          .put(
            path,
            typeof attachment.content === 'string'
              ? Buffer.from(attachment.content)
              : attachment.content
          )

        await Attachment.create({
          attachableType: attachable.constructor.name,
          attachableId: attachable.id,
          filename,
          originalFilename: attachment.filename || 'attachment',
          mimeType: attachment.contentType || 'application/octet-stream',
          size,
          disk,
          path,
        })

        stored++
      } catch {
        // Skip failed attachments
      }
    }
  }

  /**
   * Sanitize email subject.
   */
  protected sanitizeSubject(subject: string): string {
    let cleaned = subject.trim()
    while (/^(RE|FW|FWD)\s*:\s*/i.test(cleaned)) {
      cleaned = cleaned.replace(/^(RE|FW|FWD)\s*:\s*/i, '')
    }

    // Remove ticket reference brackets
    cleaned = cleaned.replace(/\[ESC-\d+\]\s*/g, '')

    return cleaned.trim() || '(No Subject)'
  }

  /**
   * Sanitize HTML content.
   */
  protected sanitizeHtml(html: string | null): string | null {
    if (!html || !html.trim()) return html

    // Build a regex to strip non-allowed tags
    const tagPattern = ALLOWED_HTML_TAGS.join('|')
    const stripRegex = new RegExp(`<(?!\\/?(${tagPattern})(\\s|>|\\/))\\/?[^>]*>`, 'gi')
    let clean = html.replace(stripRegex, '')

    // Remove event handlers
    clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    clean = clean.replace(/\s+on\w+\s*=\s*\S+/gi, '')

    // Remove javascript: protocol
    clean = clean.replace(/\b(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi, '$1="')

    // Remove dangerous data: URLs (allow data:image)
    clean = clean.replace(/\b(href|src|action)\s*=\s*["']?\s*data\s*:(?!image\/)/gi, '$1="')

    // Remove CSS expressions
    clean = clean.replace(/style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, '')
    clean = clean.replace(/style\s*=\s*["'][^"']*url\s*\(\s*["']?\s*javascript:[^"']*["']/gi, '')

    return clean
  }

  /**
   * Get sanitized body from an inbound message.
   */
  protected getSanitizedBody(message: InboundMessage): string {
    if (message.bodyText) return message.bodyText
    if (message.bodyHtml) return this.sanitizeHtml(message.bodyHtml) ?? ''
    return ''
  }

  /**
   * Derive a display name from an email address.
   */
  protected nameFromEmail(email: string): string {
    const local = email.split('@')[0]
    return local.replace(/[._\-+]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
}
