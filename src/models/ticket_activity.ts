import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { ActivityType } from '../types.js'
import Ticket from './ticket.js'

export default class TicketActivity extends BaseModel {
  static table = 'escalated_ticket_activities'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ticketId: number

  @column()
  declare causerType: string | null

  @column()
  declare causerId: number | null

  @column()
  declare type: ActivityType

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare properties: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Note: No updated_at — only created_at for activity logs

  // ---- Relationships ----

  @belongsTo(() => Ticket, { foreignKey: 'ticketId' })
  declare ticket: BelongsTo<typeof Ticket>

  // Note: "causer" is a polymorphic relation to the host app's user model.
}
