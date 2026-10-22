import { type DateTime } from 'luxon'
import { column, computed, hasMany, scope } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import WebhookDelivery from './webhook_delivery.js'
import { canonicalEvent, canonicalEvents } from '../support/event_names.js'

/**
 * An outbound webhook subscription. When a supported lifecycle event fires,
 * every active webhook whose `events` array contains that event name receives
 * a signed HTTP POST. Mirrors the Laravel `Webhook` model.
 */
export default class Webhook extends EscalatedBaseModel {
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

  /**
   * Signs deliveries; never serialized. Pages see `has_secret` instead.
   */
  @column({ serializeAs: null })
  declare secret: string | null

  @column()
  declare active: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /** Whether a signing secret is stored, which is all a page may know of it. */
  @computed({ serializeAs: 'has_secret' })
  get hasSecret(): boolean {
    return typeof this.secret === 'string' && this.secret !== ''
  }

  // ---- Relationships ----

  @hasMany(() => WebhookDelivery, { foreignKey: 'webhookId' })
  declare deliveries: HasMany<typeof WebhookDelivery>

  // ---- Scopes ----

  static activeScope = scope((query) => {
    query.where('active', true)
  })

  // ---- Helpers ----

  /**
   * The subscribed events, with names stored by earlier releases read as their
   * canonical names (ADR 2026-10-21).
   */
  subscribedEvents(): string[] {
    return canonicalEvents(this.events)
  }

  /** Whether this webhook is subscribed to the given event name, legacy names included. */
  subscribedTo(event: string): boolean {
    return this.subscribedEvents().includes(canonicalEvent(event))
  }
}
