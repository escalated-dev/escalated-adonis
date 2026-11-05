import { type DateTime } from 'luxon'
import { column, belongsTo, scope, beforeCreate } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { UserId } from '../helpers/user_id_column.js'
import { DRAFT_STATUS, PUBLISHED_STATUS, resolveSlug } from '../support/knowledge_base.js'
import ArticleCategory from './article_category.js'

export default class Article extends EscalatedBaseModel {
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

  /**
   * Title or body contains the term, ignoring case on every database
   * (PostgreSQL's LIKE is case-sensitive), with `%` and `_` taken literally.
   */
  static search = scope((query, term: string) => {
    const like = likePattern(term)
    query.where((sub) => {
      sub
        .whereRaw("LOWER(title) LIKE ? ESCAPE '!'", [like])
        .orWhereRaw("LOWER(body) LIKE ? ESCAPE '!'", [like])
    })
  })

  /** Articles whose title contains the term first. */
  static titleMatchFirst = scope((query, term: string) => {
    query.orderByRaw("CASE WHEN LOWER(title) LIKE ? ESCAPE '!' THEN 0 ELSE 1 END", [
      likePattern(term),
    ])
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

/** `%term%`, lower-cased, with `%`, `_` and the escape character `!` escaped. */
export function likePattern(term: string): string {
  return `%${String(term)
    .toLowerCase()
    .replace(/[!%_]/g, (char) => `!${char}`)}%`
}
