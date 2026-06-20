import type { HttpContext } from '@adonisjs/core/http'
import NewsletterTracker from '../services/newsletter/newsletter_tracker.js'

export default class NewsletterEspWebhookController {
  private readonly tracker = new NewsletterTracker()

  async postmark(ctx: HttpContext) {
    const body = ctx.request.all()
    const token = this.tokenFromMessageId(String(body.MessageID ?? ''))
    switch (String(body.RecordType ?? '')) {
      case 'Open':
        await this.tracker.recordOpen(token)
        break
      case 'Click':
        await this.tracker.recordClick(token, String(body.OriginalLink ?? ''))
        break
      case 'Bounce':
        await this.tracker.recordBounce(
          token,
          ['HardBounce', 'BadEmailAddress', 'BlockedRecipient'].includes(String(body.Type ?? ''))
            ? 'hard'
            : 'soft',
          String(body.Description ?? '')
        )
        break
      case 'SpamComplaint':
        await this.tracker.recordComplaint(token)
        break
    }
    return ctx.response.json({ ok: true })
  }

  async mailgun(ctx: HttpContext) {
    const body = ctx.request.all()
    const eventData = body['event-data'] ?? {}
    const token = this.tokenFromMessageId(String(eventData?.message?.headers?.['message-id'] ?? ''))
    switch (String(eventData.event ?? '')) {
      case 'opened':
        await this.tracker.recordOpen(token)
        break
      case 'clicked':
        await this.tracker.recordClick(token, String(eventData.url ?? ''))
        break
      case 'failed':
        await this.tracker.recordBounce(
          token,
          eventData.severity === 'permanent' ? 'hard' : 'soft',
          String(eventData['delivery-status']?.description ?? '')
        )
        break
      case 'complained':
        await this.tracker.recordComplaint(token)
        break
    }
    return ctx.response.json({ ok: true })
  }

  async ses(ctx: HttpContext) {
    const body = ctx.request.all()
    const message =
      typeof body.Message === 'string' ? JSON.parse(body.Message) : (body.Message ?? body)
    const token = this.tokenFromMessageId(String(message?.mail?.messageId ?? ''))
    switch (String(message?.eventType ?? '')) {
      case 'Open':
        await this.tracker.recordOpen(token)
        break
      case 'Click':
        await this.tracker.recordClick(token, String(message?.click?.link ?? ''))
        break
      case 'Bounce':
        await this.tracker.recordBounce(
          token,
          message?.bounce?.bounceType === 'Permanent' ? 'hard' : 'soft',
          message?.bounce?.bounceSubType ?? null
        )
        break
      case 'Complaint':
        await this.tracker.recordComplaint(token)
        break
    }
    return ctx.response.json({ ok: true })
  }

  async sendgrid(ctx: HttpContext) {
    const body = ctx.request.all()
    const events = Array.isArray(body) ? body : []
    for (const event of events) {
      const token = this.tokenFromMessageId(
        String(event?.['smtp-id'] ?? event?.sg_message_id ?? '')
      )
      switch (event?.event) {
        case 'open':
          await this.tracker.recordOpen(token)
          break
        case 'click':
          await this.tracker.recordClick(token, String(event?.url ?? ''))
          break
        case 'bounce':
          await this.tracker.recordBounce(
            token,
            event?.type === 'blocked' ? 'hard' : 'soft',
            event?.reason ?? null
          )
          break
        case 'dropped':
          await this.tracker.recordBounce(token, 'hard', event?.reason ?? null)
          break
        case 'spamreport':
          await this.tracker.recordComplaint(token)
          break
      }
    }
    return ctx.response.json({ ok: true })
  }

  private tokenFromMessageId(messageId: string): string {
    const matched = messageId.match(/n-\d+-([A-Za-z0-9]+)@/)
    if (matched) return matched[1]
    const localMatched = (messageId.split('@')[0] ?? '').match(/^n-\d+-([A-Za-z0-9]+)$/)
    return localMatched?.[1] ?? ''
  }
}
