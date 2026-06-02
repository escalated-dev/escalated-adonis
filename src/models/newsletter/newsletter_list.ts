import { type DateTime } from 'luxon'
import { BaseModel, column, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import Contact from '../contact.js'
import NewsletterListMember from './newsletter_list_member.js'

export type NewsletterListKind = 'static' | 'dynamic'

export default class NewsletterList extends BaseModel {
  static table = 'escalated_newsletter_lists'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare kind: NewsletterListKind

  @column({
    prepare: (value: object | null) => (value === null ? null : JSON.stringify(value)),
    consume: (value: string | null) => (value === null ? null : JSON.parse(value)),
  })
  declare filterJson: { rules: Array<{ field: string; op: string; value: unknown }> } | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime

  @hasMany(() => NewsletterListMember, { foreignKey: 'listId' })
  declare members: HasMany<typeof NewsletterListMember>

  @manyToMany(() => Contact, {
    pivotTable: 'escalated_newsletter_list_members',
    pivotForeignKey: 'list_id',
    pivotRelatedForeignKey: 'contact_id',
  })
  declare contacts: ManyToMany<typeof Contact>
}
