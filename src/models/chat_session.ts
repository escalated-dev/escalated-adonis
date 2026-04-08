import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Ticket from './ticket.js'

export type ChatSessionStatus = 'waiting' | 'active' | 'ended' | 'abandoned'

export default class ChatSession extends BaseModel {
  static table = 'escalated_chat_sessions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ticketId: number

  @column()
  declare agentId: number | null

  @column()
  declare visitorId: number | null

  @column()
  declare visitorName: string | null

  @column()
  declare visitorEmail: string | null

  @column()
  declare visitorToken: string | null

  @column()
  declare status: ChatSessionStatus

  @column()
  declare departmentId: number | null

  @column()
  declare rating: number | null

  @column()
  declare ratingComment: string | null

  @column()
  declare messagesCount: number

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare metadata: Record<string, any> | null

  @column.dateTime()
  declare acceptedAt: DateTime | null

  @column.dateTime()
  declare endedAt: DateTime | null

  @column.dateTime()
  declare lastActivityAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => Ticket, { foreignKey: 'ticketId' })
  declare ticket: BelongsTo<typeof Ticket>

  // ---- Scopes ----

  static waiting = scope((query) => {
    query.where('status', 'waiting')
  })

  static active = scope((query) => {
    query.where('status', 'active')
  })

  static forAgent = scope((query, agentId: number) => {
    query.where('agent_id', agentId)
  })

  static idle = scope((query, idleMinutes: number) => {
    const cutoff = new Date(Date.now() - idleMinutes * 60 * 1000).toISOString()
    query.where('status', 'active').where('last_activity_at', '<', cutoff)
  })

  static abandoned = scope((query, abandonMinutes: number) => {
    const cutoff = new Date(Date.now() - abandonMinutes * 60 * 1000).toISOString()
    query.where('status', 'waiting').where('created_at', '<', cutoff)
  })
}
