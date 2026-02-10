import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Ticket from './ticket.js'
import Attachment from './attachment.js'

export default class Reply extends BaseModel {
  static table = 'escalated_replies'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare ticketId: number

  @column()
  declare authorType: string | null

  @column()
  declare authorId: number | null

  @column()
  declare body: string

  @column()
  declare isInternalNote: boolean

  @column()
  declare isPinned: boolean

  @column()
  declare type: string

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare metadata: Record<string, any> | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt: DateTime | null

  // ---- Relationships ----

  @belongsTo(() => Ticket, { foreignKey: 'ticketId' })
  declare ticket: BelongsTo<typeof Ticket>

  @hasMany(() => Attachment, {
    foreignKey: 'attachableId',
    onQuery: (query) => {
      query.where('attachable_type', 'Reply')
    },
  })
  declare attachments: HasMany<typeof Attachment>

  // Note: "author" is a polymorphic relation to the host app's user model.
  // The controller is responsible for loading this.

  // ---- Scopes ----

  static pinned = scope((query) => {
    query.where('is_pinned', true)
  })

  static publicReplies = scope((query) => {
    query.where('is_internal_note', false)
  })

  static internalNotes = scope((query) => {
    query.where('is_internal_note', true)
  })
}
