import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo, hasMany, scope, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { resolveSlug } from '../support/knowledge_base.js'
import Article from './article.js'

export default class ArticleCategory extends BaseModel {
  static table = 'escalated_article_categories'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare parentId: number | null

  @column()
  declare position: number

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => ArticleCategory, { foreignKey: 'parentId' })
  declare parent: BelongsTo<typeof ArticleCategory>

  @hasMany(() => ArticleCategory, { foreignKey: 'parentId' })
  declare children: HasMany<typeof ArticleCategory>

  @hasMany(() => Article, { foreignKey: 'categoryId' })
  declare articles: HasMany<typeof Article>

  // ---- Scopes ----

  static roots = scope((query) => {
    query.whereNull('parent_id')
  })

  static ordered = scope((query) => {
    query.orderBy('position', 'asc').orderBy('name', 'asc')
  })

  // ---- Hooks ----

  @beforeCreate()
  static assignSlug(category: ArticleCategory) {
    if (!category.slug) {
      category.slug = resolveSlug(null, category.name)
    }
  }
}
