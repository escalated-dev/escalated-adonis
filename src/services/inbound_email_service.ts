import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import InboundEmail from '../models/inbound_email.js'
import Attachment from '../models/attachment.js'
import EscalatedSetting from '../models/escalated_setting.js'
import TicketService from './ticket_service.js'
import { ESCALATED_EVENTS } from '../events/index.js'
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
      if (message.messageId && await this.isDuplicate(message.messageId, inboundEmail.id)) {
        await inboundEmail.markProcessed()
        return inboundEmail
      }

      // 2. Check if this is a reply to an existing ticket
      const existingTicket = await this.findTicketByEmail(message)

      // 3. Look up the sender
      const user = await this.findUserByEmail(message.fromEmail)

      if (existingTicket) {
        // 4. Reply to existing ticket
        const reply = await this.addReplyToTicket(existingTicket, message, user)
        await inboundEmail.markProcessed(existingTicket.id, reply.id)
      } else {
        // 5. Create new ticket
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
   */
  protected async findTicketByEmail(message: InboundMessage): Promise<Ticket | null> {
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

      await emitter.emit(ESCALATED_EVENTS.REPLY_CREATED, { reply })
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

    // Guest ticket
    const { string: stringHelper } = await import('@adonisjs/core/helpers')

    const ticket = await Ticket.create({
      reference: await Ticket.generateReference(),
      requesterType: null,
      requesterId: null,
      guestName: message.fromName || this.nameFromEmail(message.fromEmail),
      guestEmail: message.fromEmail,
      guestToken: stringHelper.random(64),
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

      const size = attachment.size || (typeof attachment.content === 'string' ? attachment.content.length : (attachment.content as Buffer).length)

      if (size > maxSize) continue

      const extension = extname(attachment.filename || '').slice(1).toLowerCase() || 'bin'

      if (BLOCKED_EXTENSIONS.includes(extension)) continue

      const filename = `${randomUUID()}.${extension}`
      const path = `${basePath}/${filename}`

      try {
        const { default: drive } = await import('@adonisjs/drive/services/main')
        await drive.use(disk as any).put(path, typeof attachment.content === 'string'
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
    return local
      .replace(/[._\-+]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
}
