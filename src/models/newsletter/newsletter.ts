import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import NewsletterList from './newsletter_list.js'
import NewsletterTemplate from './newsletter_template.js'
import NewsletterDelivery from './newsletter_delivery.js'

export type NewsletterStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed'

export default class Newsletter extends BaseModel {
  static table = 'escalated_newsletters'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare subject: string

  @column({ columnName: 'from_email' })
  declare fromEmail: string

  @column({ columnName: 'from_name' })
  declare fromName: string | null

  @column({ columnName: 'reply_to' })
  declare replyTo: string | null

  @column({ columnName: 'target_list_id' })
  declare targetListId: number

  @column({ columnName: 'template_id' })
  declare templateId: number | null

  @column()
  declare theme: string | null

  @column({ columnName: 'body_markdown' })
  declare bodyMarkdown: string | null

  @column()
  declare status: NewsletterStatus

  @column.dateTime({ columnName: 'scheduled_at' })
  declare scheduledAt: DateTime | null

  @column.dateTime({ columnName: 'sent_at' })
  declare sentAt: DateTime | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column({ columnName: 'sent_by' })
  declare sentBy: number | null

  @column({ columnName: 'summary_total' })
  declare summaryTotal: number

  @column({ columnName: 'summary_sent' })
  declare summarySent: number

  @column({ columnName: 'summary_opened' })
  declare summaryOpened: number

  @column({ columnName: 'summary_clicked' })
  declare summaryClicked: number

  @column({ columnName: 'summary_bounced' })
  declare summaryBounced: number

  @column({ columnName: 'summary_complained' })
  declare summaryComplained: number

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @belongsTo(() => NewsletterList, { foreignKey: 'targetListId' })
  declare targetList: BelongsTo<typeof NewsletterList>

  @belongsTo(() => NewsletterTemplate, { foreignKey: 'templateId' })
  declare template: BelongsTo<typeof NewsletterTemplate>

  @hasMany(() => NewsletterDelivery, { foreignKey: 'newsletterId' })
  declare deliveries: HasMany<typeof NewsletterDelivery>
}
