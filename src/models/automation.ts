import { type DateTime } from 'luxon'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'

export interface AutomationCondition {
  field: string
  operator?: string
  value: any
}

export interface AutomationAction {
  type: string
  value: any
}

export default class Automation extends BaseModel {
  static table = 'escalated_automations'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare conditions: AutomationCondition[]

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare actions: AutomationAction[]

  @column()
  declare active: boolean

  @column()
  declare position: number

  @column.dateTime()
  declare lastRunAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Scopes ----

  static activeScope = scope((query) => {
    query.where('active', true).orderBy('position')
  })
}
