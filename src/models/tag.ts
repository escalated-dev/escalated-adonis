import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, beforeCreate } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { string } from '@adonisjs/core/helpers'
import Ticket from './ticket.js'

export default class Tag extends BaseModel {
  static table = 'escalated_tags'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare color: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @manyToMany(() => Ticket, {
    pivotTable: 'escalated_ticket_tag',
    pivotForeignKey: 'tag_id',
    pivotRelatedForeignKey: 'ticket_id',
  })
  declare tickets: ManyToMany<typeof Ticket>

  // ---- Hooks ----

  @beforeCreate()
  static assignSlug(tag: Tag) {
    if (!tag.slug) {
      tag.slug = string.slug(tag.name)
    }
  }
}
