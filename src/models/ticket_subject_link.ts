import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Ticket from './ticket.js'

/**
 * Join row linking a ticket to one host-app subject (type + id).
 */
export default class TicketSubjectLink extends BaseModel {
  static table = 'escalated_ticket_subjects'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ticketId: number

  @column()
  declare subjectType: string

  @column()
  declare subjectId: string

  @column()
  declare role: string | null

  @column()
  declare position: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Ticket, { foreignKey: 'ticketId' })
  declare ticket: BelongsTo<typeof Ticket>
}
