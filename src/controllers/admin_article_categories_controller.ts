import type { HttpContext } from '@adonisjs/core/http'
import ArticleCategory from '../models/article_category.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'
import { t } from '../support/i18n.js'
import { resolveSlug } from '../support/knowledge_base.js'

/**
 * Admin knowledge-base category management (CRUD).
 *
 * Mounted behind the admin auth + `EnsureIsAdmin` middleware.
 */
export default class AdminArticleCategoriesController {
  async index(ctx: HttpContext) {
    const categories = await ArticleCategory.query()
      .withCount('articles')
      .withScopes((scopes) => scopes.ordered())

    return getRenderer().render(ctx, 'Escalated/Admin/KnowledgeBase/Categories/Index', {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        parent_id: category.parentId,
        position: category.position,
        description: category.description,
        articles_count: Number((category as any).$extras.articles_count ?? 0),
      })),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = request.only(['name', 'slug', 'parent_id', 'position', 'description'])

    const name = String(data.name ?? '').trim()
    if (name === '') {
      session.flash('error', t('admin.article_category_name_required'))
      return response.redirect().back()
    }

    await ArticleCategory.create({
      name,
      slug: resolveSlug(data.slug, name),
      parentId: toId(data.parent_id),
      position: toPosition(data.position),
      description: data.description ? String(data.description) : null,
    })

    session.flash('success', t('admin.article_category_created'))
    return redirectToRoute(response, 'escalated.admin.kb-categories.index')
  }

  async update({ params, request, response, session }: HttpContext) {
    const category = await ArticleCategory.find(params.id)
    if (!category) {
      session.flash('error', t('admin.article_category_not_found'))
      return redirectToRoute(response, 'escalated.admin.kb-categories.index')
    }

    const data = request.only(['name', 'slug', 'parent_id', 'position', 'description'])
    const name = String(data.name ?? '').trim()
    if (name === '') {
      session.flash('error', t('admin.article_category_name_required'))
      return response.redirect().back()
    }

    category.merge({
      name,
      slug: resolveSlug(data.slug, name),
      parentId: toId(data.parent_id),
      position: toPosition(data.position),
      description: data.description ? String(data.description) : null,
    })
    await category.save()

    session.flash('success', t('admin.article_category_updated'))
    return redirectToRoute(response, 'escalated.admin.kb-categories.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const category = await ArticleCategory.find(params.id)
    if (!category) {
      session.flash('error', t('admin.article_category_not_found'))
      return redirectToRoute(response, 'escalated.admin.kb-categories.index')
    }

    await category.delete()
    session.flash('success', t('admin.article_category_deleted'))
    return redirectToRoute(response, 'escalated.admin.kb-categories.index')
  }
}

/** Coerce a request value to a positive integer id, or null. */
function toId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Coerce a request value to a non-negative position, defaulting to 0. */
function toPosition(value: unknown): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : 0
}
