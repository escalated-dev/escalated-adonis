import { DateTime } from 'luxon'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'

export default class CannedResponse extends BaseModel {
  static table = 'escalated_canned_responses'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare body: string

  @column()
  declare category: string | null

  @column()
  declare createdBy: number | null

  @column()
  declare isShared: boolean

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
