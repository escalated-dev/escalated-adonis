import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Article from '../models/article.js'
import ArticleCategory from '../models/article_category.js'
import EscalatedSetting from '../models/escalated_setting.js'
import { getRenderer } from '../rendering/renderer.js'
import { laravelPaginatorShape } from '../support/pagination.js'
import { PUBLISHED_STATUS } from '../support/knowledge_base.js'

const PER_PAGE = 15

/**
 * The knowledge base reader for signed-in customers. Mirrors
 * escalated-laravel's `Customer\KnowledgeBaseController`: the same pages,
 * props, feedback write and settings.
 *
 * The routes sit behind the `knowledgeBaseGuard` middleware, which answers
 * 404 while `knowledge_base_enabled` is off and 403 to a visitor without a
 * session when `knowledge_base_public` is off.
 */
export default class CustomerKnowledgeBaseController {
  /**
   * GET {prefix}/kb — published articles, newest first, with search and
   * category filters, plus the root categories and their published counts.
   */
  async index(ctx: HttpContext) {
    const { request } = ctx
    const search = String(request.input('search', '') ?? '').trim()
    const category = String(request.input('category', '') ?? '').trim()
    const page = Math.max(1, Number.parseInt(String(request.input('page', 1)), 10) || 1)

    const categories = await ArticleCategory.query().withScopes((s) => {
      s.roots()
      s.ordered()
    })
    const counts = await db
      .from('escalated_articles')
      .where('status', PUBLISHED_STATUS)
      .whereNotNull('category_id')
      .select('category_id')
      .count('* as total')
      .groupBy('category_id')
    const publishedByCategory = new Map(
      counts.map((row: any) => [Number(row.category_id), Number(row.total)])
    )

    const query = Article.query()
      .withScopes((s) => s.published())
      .preload('category')
    if (search) query.withScopes((s) => s.search(search))
    if (category) query.where('category_id', category)

    const paginator = await query
      .orderBy('published_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, PER_PAGE)

    const filters: Record<string, string> = {}
    if (request.input('search') !== undefined) filters.search = String(request.input('search'))
    if (request.input('category') !== undefined)
      filters.category = String(request.input('category'))

    return getRenderer().render(ctx, 'Escalated/Customer/KnowledgeBase/Index', {
      categories: categories.map((row) => ({
        ...this.serializeCategory(row),
        parent_id: row.parentId,
        position: row.position,
        articles_count: publishedByCategory.get(row.id) ?? 0,
      })),
      articles: laravelPaginatorShape(
        paginator,
        paginator.all().map((article) => this.serializeArticle(article)),
        request.url(),
        { search: search || undefined, category: category || undefined }
      ),
      filters,
      feedbackEnabled: await this.feedbackEnabled(),
    })
  }

  /**
   * GET {prefix}/kb/:slug — one published article, counted as a view, with up
   * to five other published articles from its category.
   */
  async show(ctx: HttpContext) {
    const article = await this.publishedArticle(ctx.params.slug)
    await article.load('category')
    await article.incrementViews()

    const related = await Article.query()
      .withScopes((s) => s.published())
      .where((q) => {
        if (article.categoryId === null) q.whereNull('category_id')
        else q.where('category_id', article.categoryId)
      })
      .whereNot('id', article.id)
      .orderBy('id', 'asc')
      .limit(5)
      .select('id', 'title', 'slug')

    return getRenderer().render(ctx, 'Escalated/Customer/KnowledgeBase/Article', {
      article: { ...this.serializeArticle(article), body: article.body },
      related: related.map((row) => ({ id: row.id, title: row.title, slug: row.slug })),
      feedbackEnabled: await this.feedbackEnabled(),
    })
  }

  /**
   * POST {prefix}/kb/:slug/feedback — `{ helpful: boolean }`. 404 while
   * feedback is turned off.
   */
  async feedback({ params, request, response, session }: HttpContext) {
    if (!(await this.feedbackEnabled())) {
      return response.notFound({ error: 'Not found' })
    }

    const article = await this.publishedArticle(params.slug)

    const helpful = this.parseBoolean(request.input('helpful'))
    if (helpful === null) {
      session.flash('error', 'The helpful field must be true or false.')
      return response.redirect().back()
    }

    if (helpful) await article.markHelpful()
    else await article.markNotHelpful()

    session.flash('success', 'Thank you for your feedback!')
    return response.redirect().back()
  }

  // ---- Helpers ----

  protected async publishedArticle(slug: string) {
    return Article.query()
      .withScopes((s) => s.published())
      .where('slug', String(slug ?? ''))
      .firstOrFail()
  }

  protected feedbackEnabled() {
    return EscalatedSetting.getBool('knowledge_base_feedback_enabled', true)
  }

  /** Laravel's `boolean` rule: true, false, 1, 0, "1", "0". */
  protected parseBoolean(value: unknown): boolean | null {
    if (value === true || value === 1 || value === '1' || value === 'true') return true
    if (value === false || value === 0 || value === '0' || value === 'false') return false
    return null
  }

  protected serializeCategory(category: ArticleCategory) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
    }
  }

  protected serializeArticle(article: Article) {
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      category_id: article.categoryId,
      view_count: Number(article.viewCount ?? 0),
      helpful_count: Number(article.helpfulCount ?? 0),
      not_helpful_count: Number(article.notHelpfulCount ?? 0),
      published_at: article.publishedAt?.toISO() ?? null,
      category: article.category ? this.serializeCategory(article.category) : null,
    }
  }
}
