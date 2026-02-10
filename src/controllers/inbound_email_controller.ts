import type { HttpContext } from '@adonisjs/core/http'
import EscalatedSetting from '../models/escalated_setting.js'
import InboundEmailService from '../services/inbound_email_service.js'
import { getConfig } from '../helpers/config.js'
import type { InboundMessage } from '../types.js'

export default class InboundEmailController {
  protected service = new InboundEmailService()

  /**
   * POST /support/inbound/:adapter — Handle inbound email webhook
   */
  async webhook({ params, request, response }: HttpContext) {
    const config = getConfig()

    // Verify inbound email is enabled
    const enabled = await EscalatedSetting.getBool(
      'inbound_email_enabled',
      config.inboundEmail?.enabled ?? false
    )
    if (!enabled) {
      return response.notFound({ error: 'Inbound email is disabled.' })
    }

    const adapter = params.adapter as string

    // Verify the request based on adapter
    if (!this.verifyRequest(adapter, request)) {
      return response.forbidden({ error: 'Invalid signature.' })
    }

    try {
      const message = this.parseRequest(adapter, request)
      const inboundEmail = await this.service.process(message, adapter)

      return response.json({
        status: 'ok',
        id: inboundEmail.id,
      })
    } catch (error: any) {
      return response.internalServerError({ error: 'Processing failed.' })
    }
  }

  /**
   * Verify the inbound email request based on adapter.
   */
  protected verifyRequest(adapter: string, request: any): boolean {
    const config = getConfig()

    switch (adapter) {
      case 'mailgun': {
        const signingKey = config.inboundEmail?.mailgun?.signingKey
        if (!signingKey) return true // No key configured, skip verification

        // Mailgun signature verification
        const timestamp = request.input('timestamp')
        const token = request.input('token')
        const signature = request.input('signature')
        if (!timestamp || !token || !signature) return false

        const { createHmac } = require('node:crypto')
        const expected = createHmac('sha256', signingKey)
          .update(`${timestamp}${token}`)
          .digest('hex')
        return expected === signature
      }

      case 'postmark': {
        // Postmark uses a token-based approach
        return true
      }

      case 'ses': {
        // AWS SES uses SNS subscription confirmation
        return true
      }

      default:
        return false
    }
  }

  /**
   * Parse the inbound email request into a normalized InboundMessage.
   */
  protected parseRequest(adapter: string, request: any): InboundMessage {
    switch (adapter) {
      case 'mailgun':
        return this.parseMailgun(request)
      case 'postmark':
        return this.parsePostmark(request)
      case 'ses':
        return this.parseSes(request)
      default:
        throw new Error(`Unknown adapter: ${adapter}`)
    }
  }

  protected parseMailgun(request: any): InboundMessage {
    return {
      messageId: request.input('Message-Id') || request.input('message-id'),
      fromEmail: request.input('sender') || request.input('from', ''),
      fromName: undefined,
      toEmail: request.input('recipient') || request.input('to', ''),
      subject: request.input('subject', ''),
      bodyText: request.input('body-plain') || request.input('stripped-text'),
      bodyHtml: request.input('body-html') || request.input('stripped-html'),
      inReplyTo: request.input('In-Reply-To'),
      references: request.input('References'),
      rawHeaders: {},
      attachments: [],
    }
  }

  protected parsePostmark(request: any): InboundMessage {
    const body = request.body()
    return {
      messageId: body.MessageID,
      fromEmail: body.FromFull?.Email || body.From || '',
      fromName: body.FromFull?.Name,
      toEmail: body.ToFull?.[0]?.Email || body.To || '',
      subject: body.Subject || '',
      bodyText: body.TextBody,
      bodyHtml: body.HtmlBody,
      inReplyTo: body.Headers?.find((h: any) => h.Name === 'In-Reply-To')?.Value,
      references: body.Headers?.find((h: any) => h.Name === 'References')?.Value,
      rawHeaders: {},
      attachments: (body.Attachments || []).map((a: any) => ({
        filename: a.Name,
        contentType: a.ContentType,
        content: Buffer.from(a.Content, 'base64'),
        size: a.ContentLength,
      })),
    }
  }

  protected parseSes(request: any): InboundMessage {
    const body = request.body()

    // Handle SNS notification wrapper
    if (body.Type === 'SubscriptionConfirmation') {
      return {
        fromEmail: 'sns-confirmation@amazonaws.com',
        toEmail: '',
        subject: 'SNS Subscription Confirmation',
        attachments: [],
      }
    }

    const message = body.Message ? JSON.parse(body.Message) : body
    const mail = message.mail || {}
    const content = message.content || {}

    return {
      messageId: mail.messageId,
      fromEmail: mail.source || mail.commonHeaders?.from?.[0] || '',
      fromName: undefined,
      toEmail: mail.destination?.[0] || '',
      subject: mail.commonHeaders?.subject || '',
      bodyText: content.textBody,
      bodyHtml: content.htmlBody,
      rawHeaders: {},
      attachments: [],
    }
  }
}
