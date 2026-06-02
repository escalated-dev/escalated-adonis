import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import Contact from '../../models/contact.js'
import type Newsletter from '../../models/newsletter/newsletter.js'
import NewsletterDelivery from '../../models/newsletter/newsletter_delivery.js'
import BounceSuppressionStore from './bounce_suppression_store.js'
import ContactSegmentResolver from './contact_segment_resolver.js'

export default class NewsletterPlanner {
  constructor(
    private readonly segments = new ContactSegmentResolver(),
    private readonly bounces = new BounceSuppressionStore()
  ) {}

  async plan(newsletter: Newsletter): Promise<void> {
    newsletter.status = 'sending'
    await newsletter.save()

    await newsletter.load('targetList')
    const contactIds = await this.segments.resolveSendable(newsletter.targetList)
    if (contactIds.length === 0) {
      newsletter.summaryTotal = 0
      await newsletter.save()
      return
    }

    const contacts = await Contact.query().whereIn('id', contactIds).select('id', 'email')

    const sendableEmails = await this.bounces.filterSendable(contacts.map((c) => c.email))
    const sendable = new Set(sendableEmails.map((e) => e.toLowerCase()))

    const rows: Array<Partial<NewsletterDelivery>> = []
    for (const contact of contacts) {
      if (!sendable.has(contact.email.toLowerCase())) continue
      rows.push({
        newsletterId: newsletter.id,
        contactId: contact.id,
        emailAtSend: contact.email,
        status: 'pending',
        trackingToken: randomBytes(20).toString('hex'),
        attemptCount: 0,
        isTest: false,
        createdAt: DateTime.now(),
      })
    }

    for (let i = 0; i < rows.length; i += 500) {
      await NewsletterDelivery.createMany(rows.slice(i, i + 500) as any)
    }

    newsletter.summaryTotal = rows.length
    await newsletter.save()
  }
}
