import { DateTime } from 'luxon'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'
import type { MacroAction } from '../types.js'

export default class Macro extends BaseModel {
  static table = 'escalated_macros'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare actions: MacroAction[]

  @column()
  declare createdBy: number | null

  @column()
  declare isShared: boolean

  @column()
  declare order: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Scopes ----

  static shared = scope((query) => {
    query.where('is_shared', true)
  })

  static forAgent = scope((query, agentId: number) => {
    query.where((q) => {
      q.where('is_shared', true).orWhere('created_by', agentId)
    })
  })
}
