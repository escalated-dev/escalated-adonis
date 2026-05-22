import { DateTime } from 'luxon'
import Newsletter from '../../models/newsletter/newsletter.js'
import NewsletterDelivery from '../../models/newsletter/newsletter_delivery.js'
import BounceSuppressionStore from './bounce_suppression_store.js'

export default class NewsletterTracker {
  constructor(private readonly bounces = new BounceSuppressionStore()) {}

  async recordOpen(token: string): Promise<void> {
    const d = await NewsletterDelivery.findBy('trackingToken', token)
    if (!d) return
    if (['bounced', 'complained', 'failed'].includes(d.status)) return
    if (d.openedAt) return
    d.openedAt = DateTime.now()
    await d.save()
    await Newsletter.query().where('id', d.newsletterId).increment('summary_opened', 1)
  }

  async recordClick(token: string, _url: string): Promise<void> {
    const d = await NewsletterDelivery.findBy('trackingToken', token)
    if (!d) return
    if (['bounced', 'complained', 'failed'].includes(d.status)) return
    const firstClick = d.clicksCount === 0
    d.clicksCount = d.clicksCount + 1
    d.lastClickedAt = DateTime.now()
    if (!d.openedAt) {
      d.openedAt = DateTime.now()
      await Newsletter.query().where('id', d.newsletterId).increment('summary_opened', 1)
    }
    await d.save()
    if (firstClick) {
      await Newsletter.query().where('id', d.newsletterId).increment('summary_clicked', 1)
    }
  }

  async recordBounce(token: string, type: 'hard' | 'soft', reason?: string): Promise<void> {
    if (type !== 'hard') return
    const d = await NewsletterDelivery.findBy('trackingToken', token)
    if (!d) return
    if (d.status === 'bounced') return
    d.status = 'bounced'
    d.bounceReason = reason ?? null
    await d.save()
    await Newsletter.query().where('id', d.newsletterId).increment('summary_bounced', 1)
    await this.bounces.markBounced(d.emailAtSend)
  }

  async recordComplaint(token: string): Promise<void> {
    const d = await NewsletterDelivery.findBy('trackingToken', token)
    if (!d) return
    if (d.status === 'complained') return
    d.status = 'complained'
    await d.save()
    await Newsletter.query().where('id', d.newsletterId).increment('summary_complained', 1)
    await this.bounces.markComplained(d.emailAtSend)
  }
}
