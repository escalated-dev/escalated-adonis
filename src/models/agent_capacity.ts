import { type DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { UserId } from '../helpers/user_id_column.js'

/**
 * Per-agent, per-channel concurrent-ticket capacity. Tracks how many open
 * tickets an agent is carrying (currentCount) against their configured
 * ceiling (maxConcurrent) so routing can avoid overloading. Mirrors the
 * Laravel AgentCapacity model.
 */
export default class AgentCapacity extends BaseModel {
  static table = 'escalated_agent_capacity'

  static DEFAULT_MAX_CONCURRENT = 10

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: UserId

  @column()
  declare channel: string

  @column()
  declare maxConcurrent: number

  @column()
  declare currentCount: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
