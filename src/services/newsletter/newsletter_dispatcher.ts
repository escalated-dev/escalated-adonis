import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import Newsletter from '../../models/newsletter/newsletter.js'
import NewsletterDelivery from '../../models/newsletter/newsletter_delivery.js'
import NewsletterRenderer, { RendererOptions } from './newsletter_renderer.js'

export interface DispatcherOptions {
  enableNewsletters?: boolean
  batchSize?: number
  claimTimeoutMinutes?: number
  autoPauseBounceRate?: number
  autoPauseThreshold?: number
  rendererOptions?: RendererOptions
}

export default class NewsletterDispatcher {
  private readonly renderer: NewsletterRenderer

  constructor(private readonly options: DispatcherOptions = {}) {
    this.renderer = new NewsletterRenderer(options.rendererOptions)
  }

  async dispatchBatch(): Promise<void> {
    if (this.options.enableNewsletters === false) return

    await this.reclaimStuckRows()

    const batchSize = this.options.batchSize ?? 50
    const pending = await NewsletterDelivery.query()
      .where('status', 'pending')
      .orderBy('id', 'asc')
      .limit(batchSize)

    if (pending.length === 0) {
      await this.finalizeCompletedNewsletters()
      return
    }

    await NewsletterDelivery.query()
      .whereIn('id', pending.map((d) => d.id))
      .update({ status: 'queued', claimed_at: DateTime.now().toSQL() })

    for (const d of pending) {
      await this.dispatchOne(d)
    }

    await this.finalizeCompletedNewsletters()
    await this.checkAutoPauseAcrossActiveNewsletters()
  }

  private async dispatchOne(delivery: NewsletterDelivery): Promise<void> {
    const full = await NewsletterDelivery.query()
      .where('id', delivery.id)
      .preload('contact')
      .preload('newsletter', (q) => q.preload('template'))
      .firstOrFail()

    try {
      const html = this.renderer.render(full)
      const unsub = this.renderer.unsubscribeUrl(full)
      const baseUrl = this.options.rendererOptions?.baseUrl ?? 'http://localhost'
      const host = (() => {
        try {
          return new URL(baseUrl).host
        } catch {
          return 'localhost'
        }
      })()

      await mail.send((message) => {
        message
          .to(full.emailAtSend)
          .from(full.newsletter.fromEmail, full.newsletter.fromName ?? undefined)
          .subject(full.newsletter.subject)
          .html(html)
        if (full.newsletter.replyTo) message.replyTo(full.newsletter.replyTo)
        message.header('List-Unsubscribe', `<${unsub}>`)
        message.header('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click')
        message.header('X-Escalated-Newsletter-Id', String(full.newsletterId))
        message.header('Message-ID', `<n-${full.newsletterId}-${full.trackingToken}@${host}>`)
      })

      full.status = 'sent'
      full.sentAt = DateTime.now()
      full.claimedAt = null
      await full.save()
      await Newsletter.query().where('id', full.newsletterId).increment('summary_sent', 1)
    } catch (error) {
      logger.warn(
        `Newsletter delivery ${full.id} failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      const attempts = full.attemptCount + 1
      if (attempts >= 3) {
        full.status = 'failed'
        full.failureReason = error instanceof Error ? error.message : String(error)
        full.attemptCount = attempts
        full.claimedAt = null
      } else {
        full.status = 'pending'
        full.attemptCount = attempts
        full.claimedAt = null
      }
      await full.save()
    }
  }

  private async reclaimStuckRows(): Promise<void> {
    const minutes = this.options.claimTimeoutMinutes ?? 10
    const cutoff = DateTime.now().minus({ minutes }).toSQL()
    await NewsletterDelivery.query()
      .where('status', 'queued')
      .where('claimed_at', '<', cutoff!)
      .update({ status: 'pending', claimed_at: null })
  }

  private async finalizeCompletedNewsletters(): Promise<void> {
    const sending = await Newsletter.query().where('status', 'sending')
    for (const n of sending) {
      const remaining = await NewsletterDelivery.query()
        .where('newsletter_id', n.id)
        .whereIn('status', ['pending', 'queued'])
        .first()
      if (!remaining) {
        n.status = 'sent'
        if (!n.sentAt) n.sentAt = DateTime.now()
        await n.save()
      }
    }
  }

  private async checkAutoPauseAcrossActiveNewsletters(): Promise<void> {
    const threshold = this.options.autoPauseThreshold ?? 100
    const rate = this.options.autoPauseBounceRate ?? 0.05
    const sending = await Newsletter.query().where('status', 'sending')
    for (const n of sending) {
      const totalRows = await NewsletterDelivery.query()
        .where('newsletter_id', n.id)
        .whereIn('status', ['sent', 'bounced', 'complained', 'failed'])
        .count('* as total')
      const total = Number((totalRows[0] as any).$extras?.total ?? 0)
      if (total < threshold) continue
      const bouncedRows = await NewsletterDelivery.query()
        .where('newsletter_id', n.id)
        .where('status', 'bounced')
        .count('* as total')
      const bounced = Number((bouncedRows[0] as any).$extras?.total ?? 0)
      if (total > 0 && bounced / total >= rate) {
        n.status = 'paused'
        await n.save()
        logger.warn(`Newsletter ${n.id} auto-paused: ${bounced}/${total} bounced`)
      }
    }
  }
}
