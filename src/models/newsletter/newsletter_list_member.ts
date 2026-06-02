import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Contact from '../contact.js'
import NewsletterList from './newsletter_list.js'

export default class NewsletterListMember extends BaseModel {
  static table = 'escalated_newsletter_list_members'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'list_id' })
  declare listId: number

  @column({ columnName: 'contact_id' })
  declare contactId: number

  @column.dateTime({ columnName: 'added_at' })
  declare addedAt: DateTime

  @column({ columnName: 'added_by' })
  declare addedBy: number | null

  @belongsTo(() => NewsletterList, { foreignKey: 'listId' })
  declare list: BelongsTo<typeof NewsletterList>

  @belongsTo(() => Contact, { foreignKey: 'contactId' })
  declare contact: BelongsTo<typeof Contact>
}
