import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Ticket from './ticket.js'

/**
 * A directional relationship between two tickets (problem/incident,
 * parent/child, or related). Distinct from TicketSubjectLink, which links a
 * ticket to a host-app subject. Mirrors the Laravel TicketLink model.
 */
export default class TicketLink extends BaseModel {
  static table = 'escalated_ticket_links'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare parentTicketId: number

  @column()
  declare childTicketId: number

  @column()
  declare linkType: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => Ticket, { foreignKey: 'parentTicketId' })
  declare parentTicket: BelongsTo<typeof Ticket>

  @belongsTo(() => Ticket, { foreignKey: 'childTicketId' })
  declare childTicket: BelongsTo<typeof Ticket>
}
