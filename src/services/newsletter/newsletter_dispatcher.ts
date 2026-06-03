import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import Newsletter from '../../models/newsletter/newsletter.js'
import NewsletterDelivery from '../../models/newsletter/newsletter_delivery.js'
import NewsletterRenderer, { type RendererOptions } from './newsletter_renderer.js'

export interface DispatcherOptions {
  enableNewsletters?: boolean
  batchSize?: number
  rateLimitPerMinute?: number
  claimTimeoutMinutes?: number
  autoPauseBounceRate?: number
  autoPauseThreshold?: number
  rendererOptions?: RendererOptions
}

const BACKOFF_MINUTES = [1, 5, 30]

export default class NewsletterDispatcher {
  private readonly renderer: NewsletterRenderer

  constructor(private readonly options: DispatcherOptions = {}) {
    this.renderer = new NewsletterRenderer(options.rendererOptions)
  }

  async dispatchBatch(): Promise<void> {
    if (this.options.enableNewsletters === false) return

    await this.reclaimStuckRows()

    const batchSize = this.options.batchSize ?? 50
    const rateLimitPerMinute = this.options.rateLimitPerMinute ?? 60
    const sentThisMinute = await this.countSentThisMinute()
    const allowance = Math.max(0, rateLimitPerMinute - sentThisMinute)

    if (allowance === 0) {
      await this.finalizeCompletedNewsletters()
      await this.checkAutoPauseAcrossActiveNewsletters()
      return
    }

    const claimLimit = Math.min(batchSize, allowance)
    const pending = await db.transaction(async (trx) => {
      const rows = await NewsletterDelivery.query({ client: trx })
        .where('status', 'pending')
        .where((query) => {
          query
            .whereNull('next_attempt_at')
            .orWhere('next_attempt_at', '<=', DateTime.now().toSQL()!)
        })
        .orderBy('id', 'asc')
        .limit(claimLimit)
        .forUpdate()

      if (rows.length === 0) return []

      await NewsletterDelivery.query({ client: trx })
        .whereIn(
          'id',
          rows.map((d) => d.id)
        )
        .update({ status: 'queued', claimed_at: DateTime.now().toSQL() })

      return rows
    })

    if (pending.length === 0) {
      await this.finalizeCompletedNewsletters()
      await this.checkAutoPauseAcrossActiveNewsletters()
      return
    }

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
      full.nextAttemptAt = null
      await full.save()
      await Newsletter.query().where('id', full.newsletterId).increment('summary_sent', 1)
    } catch (error) {
      logger.warn(
        `Newsletter delivery ${full.id} failed: ${error instanceof Error ? error.message : String(error)}`
      )
      const attempts = full.attemptCount + 1
      if (attempts >= 3) {
        full.status = 'failed'
        full.failureReason = error instanceof Error ? error.message : String(error)
        full.attemptCount = attempts
        full.claimedAt = null
        full.nextAttemptAt = null
      } else {
        full.status = 'pending'
        full.attemptCount = attempts
        full.claimedAt = null
        const minutes = BACKOFF_MINUTES[attempts - 1] ?? 30
        full.nextAttemptAt = DateTime.now().plus({ minutes })
      }
      await full.save()
    }
  }

  private async countSentThisMinute(): Promise<number> {
    const startOfMinute = DateTime.now().startOf('minute').toSQL()
    const result = await NewsletterDelivery.query()
      .where('status', 'sent')
      .where('sent_at', '>=', startOfMinute!)
      .count('* as total')
    return Number((result[0] as { $extras?: { total?: number } }).$extras?.total ?? 0)
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
      const firstTerminal = await NewsletterDelivery.query()
        .where('newsletter_id', n.id)
        .whereIn('status', ['sent', 'bounced', 'complained', 'failed'])
        .orderBy('id', 'asc')
        .limit(threshold)
        .select('id', 'status')

      if (firstTerminal.length < threshold) continue

      const bounced = firstTerminal.filter((delivery) => delivery.status === 'bounced').length
      if (bounced / threshold >= rate) {
        n.status = 'paused'
        await n.save()
        logger.warn(`Newsletter ${n.id} auto-paused: ${bounced}/${threshold} bounced`)
      }
    }
  }
}
