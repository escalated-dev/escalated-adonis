import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo, scope, beforeCreate } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { UserId } from '../helpers/user_id_column.js'
import { DRAFT_STATUS, PUBLISHED_STATUS, resolveSlug } from '../support/knowledge_base.js'
import ArticleCategory from './article_category.js'

export default class Article extends BaseModel {
  static table = 'escalated_articles'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare categoryId: number | null

  @column()
  declare title: string

  @column()
  declare slug: string

  @column()
  declare body: string | null

  @column()
  declare status: string

  @column()
  declare authorId: UserId | null

  @column()
  declare viewCount: number

  @column()
  declare helpfulCount: number

  @column()
  declare notHelpfulCount: number

  @column.dateTime()
  declare publishedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => ArticleCategory, { foreignKey: 'categoryId' })
  declare category: BelongsTo<typeof ArticleCategory>

  // ---- Scopes ----

  static published = scope((query) => {
    query.where('status', PUBLISHED_STATUS)
  })

  static draft = scope((query) => {
    query.where('status', DRAFT_STATUS)
  })

  static search = scope((query, term: string) => {
    const like = `%${term}%`
    query.where((sub) => {
      sub.where('title', 'like', like).orWhere('body', 'like', like)
    })
  })

  // ---- Hooks ----

  @beforeCreate()
  static assignSlug(article: Article) {
    if (!article.slug) {
      article.slug = resolveSlug(null, article.title)
    }
  }

  // ---- Counters (atomic) ----

  async incrementViews(): Promise<void> {
    await Article.query().where('id', this.id).increment('view_count', 1)
    this.viewCount = (this.viewCount ?? 0) + 1
  }

  async markHelpful(): Promise<void> {
    await Article.query().where('id', this.id).increment('helpful_count', 1)
    this.helpfulCount = (this.helpfulCount ?? 0) + 1
  }

  async markNotHelpful(): Promise<void> {
    await Article.query().where('id', this.id).increment('not_helpful_count', 1)
    this.notHelpfulCount = (this.notHelpfulCount ?? 0) + 1
  }
}
