import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { UserId } from '../helpers/user_id_column.js'
import Ticket from './ticket.js'

export default class SatisfactionRating extends BaseModel {
  static table = 'escalated_satisfaction_ratings'

  // Disable auto timestamps — we only use created_at
  static selfAssignPrimaryKey = false

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ticketId: number

  @column()
  declare rating: number

  @column()
  declare comment: string | null

  @column()
  declare ratedByType: string | null

  @column()
  declare ratedById: UserId | null

  @column.dateTime()
  declare createdAt: DateTime | null

  // ---- Relationships ----

  @belongsTo(() => Ticket, { foreignKey: 'ticketId' })
  declare ticket: BelongsTo<typeof Ticket>

  // Note: "ratedBy" is a polymorphic relation to the host app's user model.

  // ---- Hooks ----

  @beforeCreate()
  static assignCreatedAt(rating: SatisfactionRating) {
    if (!rating.createdAt) {
      rating.createdAt = DateTime.now()
    }
  }
}
