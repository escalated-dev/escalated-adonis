import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Webhook from './webhook.js'

/**
 * A single delivery attempt record for an outbound webhook. Stores the request
 * payload plus the response code/body and attempt count. Mirrors the Laravel
 * `WebhookDelivery` model.
 */
export default class WebhookDelivery extends BaseModel {
  static table = 'escalated_webhook_deliveries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare webhookId: number

  @column()
  declare event: string

  @column({
    prepare: (value: any) => (value !== undefined && value !== null ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare payload: Record<string, any> | null

  @column()
  declare responseCode: number | null

  @column()
  declare responseBody: string | null

  @column()
  declare attempts: number

  @column.dateTime()
  declare deliveredAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => Webhook, { foreignKey: 'webhookId' })
  declare webhook: BelongsTo<typeof Webhook>

  // ---- Helpers ----

  /** Whether the recorded response counts as a successful (2xx) delivery. */
  isSuccess(): boolean {
    return this.responseCode !== null && this.responseCode >= 200 && this.responseCode < 300
  }
}
