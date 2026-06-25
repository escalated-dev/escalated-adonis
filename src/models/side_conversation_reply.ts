import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { UserId } from '../helpers/user_id_column.js'
import SideConversation from './side_conversation.js'

/**
 * A single message within a SideConversation. Mirrors the Laravel
 * SideConversationReply model.
 */
export default class SideConversationReply extends BaseModel {
  static table = 'escalated_side_conversation_replies'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sideConversationId: number

  @column()
  declare body: string

  @column()
  declare authorId: UserId | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => SideConversation, { foreignKey: 'sideConversationId' })
  declare sideConversation: BelongsTo<typeof SideConversation>
}
