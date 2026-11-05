import { type DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { UserId } from '../helpers/user_id_column.js'

/**
 * When an agent last read a ticket (ADR 2026-11-05-agent-panel-data).
 * `lastReadAt` null means the agent marked it unread.
 */
export default class TicketRead extends EscalatedBaseModel {
  static table = 'escalated_ticket_reads'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: UserId

  @column()
  declare ticketId: number

  @column.dateTime()
  declare lastReadAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
