import { DateTime } from 'luxon'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'

export default class Plugin extends BaseModel {
  static table = 'escalated_plugins'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare slug: string

  @column()
  declare isActive: boolean

  @column.dateTime()
  declare activatedAt: DateTime | null

  @column.dateTime()
  declare deactivatedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Scopes ----

  static active = scope((query) => {
    query.where('is_active', true)
  })

  static inactive = scope((query) => {
    query.where('is_active', false)
  })
}
