import { type DateTime } from 'luxon'
import { BaseModel, column, scope } from '@adonisjs/lucid/orm'

export default class SavedView extends BaseModel {
  static table = 'escalated_saved_views'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare userId: number | null

  @column()
  declare isShared: boolean

  @column()
  declare isDefault: boolean

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : '{}'),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : {}),
  })
  declare filters: Record<string, any>

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare columns: string[] | null

  @column()
  declare sortBy: string | null

  @column()
  declare sortDir: string

  @column()
  declare icon: string | null

  @column()
  declare color: string | null

  @column()
  declare order: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Scopes ----

  /**
   * Views visible to a specific user: their own views + shared views.
   */
  static visibleTo = scope((query, userId: number) => {
    query.where((q) => {
      q.where('user_id', userId).orWhere('is_shared', true)
    })
  })

  /**
   * Shared (global) views only.
   */
  static shared = scope((query) => {
    query.where('is_shared', true)
  })

  /**
   * Views owned by a specific user.
   */
  static ownedBy = scope((query, userId: number) => {
    query.where('user_id', userId)
  })

  // ---- Helpers ----

  /**
   * Generate a URL-safe slug from a name.
   */
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }
}
