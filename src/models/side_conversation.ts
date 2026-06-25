import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { UserId } from '../helpers/user_id_column.js'
import Ticket from './ticket.js'
import SideConversationReply from './side_conversation_reply.js'

/**
 * A side conversation — a private thread (internal note or outbound email)
 * attached to a ticket, used by agents to consult colleagues or third parties
 * without exposing the main customer thread. Mirrors the Laravel
 * SideConversation model.
 */
export default class SideConversation extends BaseModel {
  static table = 'escalated_side_conversations'

  static STATUS_OPEN = 'open'
  static STATUS_CLOSED = 'closed'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ticketId: number

  @column()
  declare subject: string

  @column()
  declare channel: string

  @column()
  declare status: string

  @column()
  declare createdBy: UserId | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => Ticket, { foreignKey: 'ticketId' })
  declare ticket: BelongsTo<typeof Ticket>

  @hasMany(() => SideConversationReply, { foreignKey: 'sideConversationId' })
  declare replies: HasMany<typeof SideConversationReply>
}
