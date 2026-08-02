import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Article from '../models/article.js'
import ArticleCategory from '../models/article_category.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'
import { getAuthUser } from '../support/auth_user.js'
import { t } from '../support/i18n.js'
import { normalizeStatus, resolveSlug, shouldSetPublishedAt } from '../support/knowledge_base.js'

/**
 * Admin knowledge-base article authoring (CRUD).
 *
 * Mounted behind the admin auth + `EnsureIsAdmin` middleware.
 */
export default class AdminArticlesController {
  async index(ctx: HttpContext) {
    const input = ctx.request.only(['search', 'status', 'category_id'])
    const search = input.search
    const status = input.status
    const categoryId = toId(input.category_id)

    const query = Article.query().preload('category')

    if (search) {
      query.withScopes((scopes) => scopes.search(String(search)))
    }
    if (status) {
      query.where('status', String(status))
    }
    if (categoryId !== null) {
      query.where('category_id', categoryId)
    }

    const articles = await query
      .orderBy('created_at', 'desc')
      .paginate(Number(ctx.request.input('page', 1)) || 1, 20)

    const categories = await ArticleCategory.query()
      .withScopes((scopes) => scopes.ordered())
      .select('id', 'name')

    return getRenderer().render(ctx, 'Escalated/Admin/KnowledgeBase/Articles/Index', {
      articles,
      categories,
      filters: { search: search ?? null, status: status ?? null, category_id: categoryId },
    })
  }

  async create(ctx: HttpContext) {
    const categories = await ArticleCategory.query()
      .withScopes((scopes) => scopes.ordered())
      .select('id', 'name')

    return getRenderer().render(ctx, 'Escalated/Admin/KnowledgeBase/Articles/Form', {
      article: null,
      categories,
    })
  }

  async store({ request, auth, response, session }: HttpContext) {
    const data = request.only(['title', 'slug', 'body', 'status', 'category_id'])

    const title = String(data.title ?? '').trim()
    if (title === '') {
      session.flash('error', t('admin.article_title_required'))
      return response.redirect().back()
    }

    const status = normalizeStatus(data.status)

    await Article.create({
      title,
      slug: resolveSlug(data.slug, title),
      body: data.body ? String(data.body) : null,
      status,
      categoryId: toId(data.category_id),
      authorId: getAuthUser(auth)?.id ?? null,
      publishedAt: shouldSetPublishedAt(status, null) ? DateTime.now() : null,
    })

    session.flash('success', t('admin.article_created'))
    return redirectToRoute(response, 'escalated.admin.kb-articles.index')
  }

  async edit(ctx: HttpContext) {
    const article = await Article.find(ctx.params.id)
    if (!article) {
      ctx.session.flash('error', t('admin.article_not_found'))
      return redirectToRoute(ctx.response, 'escalated.admin.kb-articles.index')
    }

    const categories = await ArticleCategory.query()
      .withScopes((scopes) => scopes.ordered())
      .select('id', 'name')

    return getRenderer().render(ctx, 'Escalated/Admin/KnowledgeBase/Articles/Form', {
      article,
      categories,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const article = await Article.find(params.id)
    if (!article) {
      session.flash('error', t('admin.article_not_found'))
      return redirectToRoute(response, 'escalated.admin.kb-articles.index')
    }

    const data = request.only(['title', 'slug', 'body', 'status', 'category_id'])
    const title = String(data.title ?? '').trim()
    if (title === '') {
      session.flash('error', t('admin.article_title_required'))
      return response.redirect().back()
    }

    const status = normalizeStatus(data.status)

    article.merge({
      title,
      slug: resolveSlug(data.slug, title),
      body: data.body ? String(data.body) : null,
      status,
      categoryId: toId(data.category_id),
    })

    if (shouldSetPublishedAt(status, article.publishedAt)) {
      article.publishedAt = DateTime.now()
    }

    await article.save()

    session.flash('success', t('admin.article_updated'))
    return redirectToRoute(response, 'escalated.admin.kb-articles.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const article = await Article.find(params.id)
    if (!article) {
      session.flash('error', t('admin.article_not_found'))
      return redirectToRoute(response, 'escalated.admin.kb-articles.index')
    }

    await article.delete()
    session.flash('success', t('admin.article_deleted'))
    return redirectToRoute(response, 'escalated.admin.kb-articles.index')
  }
}

/** Coerce a request value to a positive integer id, or null. */
function toId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}
