import { DateTime } from 'luxon'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'
import type { EscalationCondition, EscalationAction } from '../types.js'

export default class EscalationRule extends BaseModel {
  static table = 'escalated_escalation_rules'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare triggerType: string

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare conditions: EscalationCondition[]

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare actions: EscalationAction[]

  @column()
  declare order: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Scopes ----

  static active = scope((query) => {
    query.where('is_active', true).orderBy('order', 'asc')
  })
}
