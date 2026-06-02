import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Contact from '../models/contact.js'
import NewsletterDelivery from '../models/newsletter/newsletter_delivery.js'
import { getConfig } from '../helpers/config.js'
import NewsletterRenderer from '../services/newsletter/newsletter_renderer.js'
import NewsletterTracker from '../services/newsletter/newsletter_tracker.js'
import { decodeTrackedUrl, NewsletterValidationError } from '../support/newsletter_http.js'

const PIXEL_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63fcffff3f030005fe02fedccc59e70000000049454e44ae426082',
  'hex'
)

export default class NewsletterPublicController {
  private readonly tracker = new NewsletterTracker()
  private readonly renderer = new NewsletterRenderer(this.rendererOptions())

  private static readonly unsubscribeAttempts = new Map<
    string,
    { count: number; expiresAt: number }
  >()

  async open(ctx: HttpContext) {
    const token = String(ctx.params.token).replace(/\.(gif|png|jpg)$/i, '')
    await this.tracker.recordOpen(token)
    return ctx.response
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'private, no-store, max-age=0')
      .status(200)
      .send(PIXEL_BYTES)
  }

  async click(ctx: HttpContext) {
    try {
      const destination = decodeTrackedUrl(String(ctx.request.input('u', '')))
      await this.tracker.recordClick(String(ctx.params.token), destination)
      return ctx.response.redirect(destination, false, 302)
    } catch (error) {
      if (error instanceof NewsletterValidationError) {
        return ctx.response.status(400).send('Bad request')
      }
      throw error
    }
  }

  async unsubscribeShow(ctx: HttpContext) {
    const delivery = await this.findDelivery(String(ctx.params.token))
    return ctx.response
      .header('Content-Type', 'text/html; charset=utf-8')
      .status(200)
      .send(this.unsubscribeHtml(String(ctx.params.token), delivery?.emailAtSend ?? null, false))
  }

  async unsubscribeStore(ctx: HttpContext) {
    const ip =
      ctx.request.ip() ??
      String(ctx.request.header('x-forwarded-for') ?? 'unknown').split(',')[0]?.trim()
    if (this.tooManyUnsubscribes(ip)) {
      return ctx.response.status(429).send('Too Many Requests')
    }

    const delivery = await this.findDelivery(String(ctx.params.token))
    if (delivery?.contactId) {
      const contact = await Contact.find(delivery.contactId)
      if (contact) {
        contact.marketingOptOutAt = DateTime.now()
        await contact.save()
      }
    }

    return ctx.response
      .header('Content-Type', 'text/html; charset=utf-8')
      .status(200)
      .send(
        this.unsubscribeHtml(String(ctx.params.token), delivery?.emailAtSend ?? null, true)
      )
  }

  async view(ctx: HttpContext) {
    const delivery = await NewsletterDelivery.query()
      .where('tracking_token', String(ctx.params.token))
      .preload('newsletter', (q) => q.preload('template'))
      .preload('contact')
      .first()

    if (!delivery) {
      return ctx.response
        .header('Content-Type', 'text/html; charset=utf-8')
        .status(200)
        .send(
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Email unavailable</title></head><body><p>This email is no longer available.</p></body></html>'
        )
    }

    return ctx.response
      .header('Content-Type', 'text/html; charset=utf-8')
      .status(200)
      .send(this.renderer.render(delivery))
  }

  private async findDelivery(token: string): Promise<NewsletterDelivery | null> {
    return NewsletterDelivery.findBy('trackingToken', token)
  }

  private tooManyUnsubscribes(ip: string): boolean {
    const now = Date.now()
    const entry = NewsletterPublicController.unsubscribeAttempts.get(ip)
    if (!entry || entry.expiresAt <= now) {
      NewsletterPublicController.unsubscribeAttempts.set(ip, { count: 1, expiresAt: now + 60_000 })
      return false
    }
    entry.count += 1
    return entry.count > 60
  }

  private unsubscribeHtml(token: string, email: string | null, confirmed: boolean): string {
    const escapedToken = this.escape(token)
    const escapedEmail = this.escape(email ?? '')
    const message = confirmed
      ? 'You have been unsubscribed.'
      : 'Confirm that you want to unsubscribe from marketing emails.'
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribe</title></head><body><main><h1>Unsubscribe</h1><p>${message}</p><p>${escapedEmail}</p><form method="post" action="/escalated/n/u/${escapedToken}"><button type="submit">Unsubscribe</button></form></main></body></html>`
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  private rendererOptions() {
    const config = getConfig() as any
    return {
      baseUrl: config.appUrl ?? process.env.APP_URL ?? 'http://localhost',
      appName: config.appName,
      defaultTheme: config.newsletters?.defaultTheme ?? 'default',
      trackingEnabled: config.newsletters?.trackingEnabled !== false,
      themesDir: config.newsletters?.themesDir,
    }
  }
}
