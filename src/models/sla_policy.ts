import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, scope } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { TicketPriority } from '../types.js'
import Ticket from './ticket.js'

export default class SlaPolicy extends BaseModel {
  static table = 'escalated_sla_policies'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare isDefault: boolean

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare firstResponseHours: Record<string, number>

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare resolutionHours: Record<string, number>

  @column()
  declare businessHoursOnly: boolean

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @hasMany(() => Ticket, { foreignKey: 'slaPolicyId' })
  declare tickets: HasMany<typeof Ticket>

  // ---- Scopes ----

  static active = scope((query) => {
    query.where('is_active', true)
  })

  static isDefault = scope((query) => {
    query.where('is_default', true)
  })

  // ---- Helpers ----

  getFirstResponseHoursFor(priority: TicketPriority): number | null {
    return this.firstResponseHours?.[priority] ?? null
  }

  getResolutionHoursFor(priority: TicketPriority): number | null {
    return this.resolutionHours?.[priority] ?? null
  }
}
