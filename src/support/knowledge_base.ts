/*
|--------------------------------------------------------------------------
| Knowledge base — pure authoring & read-surface logic
|--------------------------------------------------------------------------
|
| Slug generation, publish semantics, and the "what may a public visitor
| see" contract live here as pure functions so they can be shared between
| the admin CRUD controllers and the public widget read path, and unit
| tested without a database.
|
| The `Article` Lucid model mirrors these rules as SQL scopes (`published`,
| `draft`, `search`) for efficient DB-side filtering; the constants below
| are the single source of truth for the status values both use.
|
*/

import string from '@adonisjs/core/helpers/string'

export const DRAFT_STATUS = 'draft'
export const PUBLISHED_STATUS = 'published'

export type ArticleStatus = typeof DRAFT_STATUS | typeof PUBLISHED_STATUS

/** The only statuses an article may hold. */
export const ARTICLE_STATUSES: readonly ArticleStatus[] = [DRAFT_STATUS, PUBLISHED_STATUS] as const

/**
 * Coerce arbitrary input to a valid status, defaulting to `draft`.
 * Anything that is not exactly `published` is treated as a draft.
 */
export function normalizeStatus(value: unknown): ArticleStatus {
  return value === PUBLISHED_STATUS ? PUBLISHED_STATUS : DRAFT_STATUS
}

/**
 * Resolve the slug to persist. An explicit, non-empty slug wins (normalized);
 * otherwise the source string (title / name) is slugified. Always lowercase
 * and URL-safe, mirroring Laravel's `Str::slug`.
 */
export function resolveSlug(explicit: string | null | undefined, source: string): string {
  const trimmed = typeof explicit === 'string' ? explicit.trim() : ''
  const seed = trimmed !== '' ? trimmed : (source ?? '')
  return string.slug(seed, { lower: true, strict: true })
}

/**
 * Publish semantics: stamp `published_at` only the first time an article
 * transitions into the published state. Re-saving an already-published
 * article, or saving a draft, leaves the timestamp untouched.
 */
export function shouldSetPublishedAt(status: string, currentPublishedAt: unknown): boolean {
  return status === PUBLISHED_STATUS && !currentPublishedAt
}

/** Shape shared by the pure read helpers below (accepts camel or snake keys). */
export interface ArticleLike {
  status?: string | null
  title?: string | null
  body?: string | null
  slug?: string | null
  categoryId?: number | null
  category_id?: number | null
}

/** An article is publicly visible only when published. */
export function isPublished(article: ArticleLike): boolean {
  return article.status === PUBLISHED_STATUS
}

/**
 * Case-insensitive match on title or body. An empty term matches everything,
 * mirroring `Article::scopeSearch`.
 */
export function articleMatchesSearch(article: ArticleLike, term: string): boolean {
  const needle = (term ?? '').trim().toLowerCase()
  if (needle === '') return true
  const title = (article.title ?? '').toLowerCase()
  const body = (article.body ?? '').toLowerCase()
  return title.includes(needle) || body.includes(needle)
}

export interface PublicArticleFilters {
  search?: string | null
  categoryId?: number | null
}

function categoryIdOf(article: ArticleLike): number | null {
  return article.categoryId ?? article.category_id ?? null
}

/**
 * The public read contract: only published articles, optionally narrowed by
 * a search term and/or category. Drafts are never returned regardless of the
 * filters supplied.
 */
export function selectPublicArticles<T extends ArticleLike>(
  articles: T[],
  filters: PublicArticleFilters = {}
): T[] {
  const categoryId = filters.categoryId ?? null
  const search = filters.search ?? ''

  return articles.filter((article) => {
    if (!isPublished(article)) return false
    if (categoryId !== null && categoryIdOf(article) !== categoryId) return false
    if (!articleMatchesSearch(article, search)) return false
    return true
  })
}

/**
 * Resolve a single published article by slug for the public show route.
 * Returns `undefined` for a draft or a missing slug (the caller 404s).
 */
export function findPublishedBySlug<T extends ArticleLike>(
  articles: T[],
  slug: string
): T | undefined {
  return articles.find((article) => article.slug === slug && isPublished(article))
}
