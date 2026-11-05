import { type DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { UserId } from '../helpers/user_id_column.js'

/**
 * An in-app notification for an agent (ADR 2026-11-05-agent-panel-data,
 * section 4). `data` holds the ticket id and reference; the ticket is not a
 * column, so a ticket the agent can no longer see redacts the item instead
 * of hiding it.
 */
export default class AgentNotification extends EscalatedBaseModel {
  static table = 'escalated_notifications'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: UserId

  @column()
  declare type: string

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : {}),
  })
  declare data: Record<string, any>

  @column.dateTime()
  declare readAt: DateTime | null

  @column.dateTime()
  declare createdAt: DateTime
}
