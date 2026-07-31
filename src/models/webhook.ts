import { type DateTime } from 'luxon'
import { BaseModel, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import WebhookDelivery from './webhook_delivery.js'

/**
 * An outbound webhook subscription. When a supported lifecycle event fires,
 * every active webhook whose `events` array contains that event name receives
 * a signed HTTP POST. Mirrors the Laravel `Webhook` model.
 */
export default class Webhook extends BaseModel {
  static table = 'escalated_webhooks'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare url: string

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : JSON.stringify([])),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : []),
  })
  declare events: string[]

  @column()
  declare secret: string | null

  @column()
  declare active: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @hasMany(() => WebhookDelivery, { foreignKey: 'webhookId' })
  declare deliveries: HasMany<typeof WebhookDelivery>

  // ---- Scopes ----

  static activeScope = scope((query) => {
    query.where('active', true)
  })

  // ---- Helpers ----

  /** Whether this webhook is subscribed to the given event name. */
  subscribedTo(event: string): boolean {
    return (this.events ?? []).includes(event)
  }
}
