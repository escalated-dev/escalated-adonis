import { type DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { UserId } from '../helpers/user_id_column.js'

export type AgentChatStatus = 'online' | 'away' | 'offline'

export default class AgentProfile extends BaseModel {
  static table = 'escalated_agent_profiles'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: UserId

  @column()
  declare chatStatus: AgentChatStatus

  @column()
  declare maxConcurrentChats: number

  @column.dateTime()
  declare lastSeenAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
