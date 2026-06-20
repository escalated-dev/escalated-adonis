import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Contact from '../contact.js'
import Newsletter from './newsletter.js'

export type NewsletterDeliveryStatus =
  | 'pending'
  | 'queued'
  | 'sent'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'

export default class NewsletterDelivery extends BaseModel {
  static table = 'escalated_newsletter_deliveries'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'newsletter_id' })
  declare newsletterId: number

  @column({ columnName: 'contact_id' })
  declare contactId: number

  @column({ columnName: 'email_at_send' })
  declare emailAtSend: string

  @column()
  declare status: NewsletterDeliveryStatus

  @column({ columnName: 'tracking_token' })
  declare trackingToken: string

  @column.dateTime({ columnName: 'sent_at' })
  declare sentAt: DateTime | null

  @column.dateTime({ columnName: 'opened_at' })
  declare openedAt: DateTime | null

  @column.dateTime({ columnName: 'last_clicked_at' })
  declare lastClickedAt: DateTime | null

  @column({ columnName: 'clicks_count' })
  declare clicksCount: number

  @column({ columnName: 'bounce_reason' })
  declare bounceReason: string | null

  @column({ columnName: 'failure_reason' })
  declare failureReason: string | null

  @column({ columnName: 'attempt_count' })
  declare attemptCount: number

  @column.dateTime({ columnName: 'claimed_at' })
  declare claimedAt: DateTime | null

  @column.dateTime({ columnName: 'next_attempt_at' })
  declare nextAttemptAt: DateTime | null

  @column({ columnName: 'is_test' })
  declare isTest: boolean

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @belongsTo(() => Newsletter, { foreignKey: 'newsletterId' })
  declare newsletter: BelongsTo<typeof Newsletter>

  @belongsTo(() => Contact, { foreignKey: 'contactId' })
  declare contact: BelongsTo<typeof Contact>
}
