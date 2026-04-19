import type { HttpContext } from '@adonisjs/core/http'
import SavedView from '../models/saved_view.js'
import { t } from '../support/i18n.js'
import { requireAuthUser } from '../support/auth_user.js'

export default class SavedViewsController {
  /**
   * GET /support/agent/views — List saved views for the current user
   */
  async index(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id

    const views = await SavedView.query()
      .withScopes((scopes) => scopes.visibleTo(userId))
      .orderBy('order', 'asc')
      .orderBy('name', 'asc')

    return ctx.response.json({ views })
  }

  /**
   * POST /support/agent/views — Create a new saved view
   */
  async store(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    const data = ctx.request.only([
      'name',
      'filters',
      'columns',
      'sort_by',
      'sort_dir',
      'icon',
      'color',
      'is_shared',
    ])

    const slug = SavedView.generateSlug(data.name)

    const view = await SavedView.create({
      name: data.name,
      slug,
      userId,
      isShared: data.is_shared ?? false,
      isDefault: false,
      filters: data.filters ?? {},
      columns: data.columns ?? null,
      sortBy: data.sort_by ?? null,
      sortDir: data.sort_dir ?? 'desc',
      icon: data.icon ?? null,
      color: data.color ?? null,
      order: 0,
    })

    return ctx.response.created({ view })
  }

  /**
   * PUT /support/agent/views/:id — Update a saved view
   */
  async update(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    const viewId = ctx.params.id

    const view = await SavedView.query()
      .where('id', viewId)
      .where((q) => {
        q.where('user_id', userId).orWhere('is_shared', true)
      })
      .firstOrFail()

    const data = ctx.request.only([
      'name',
      'filters',
      'columns',
      'sort_by',
      'sort_dir',
      'icon',
      'color',
      'is_shared',
    ])

    if (data.name !== undefined) {
      view.name = data.name
      view.slug = SavedView.generateSlug(data.name)
    }
    if (data.filters !== undefined) view.filters = data.filters
    if (data.columns !== undefined) view.columns = data.columns
    if (data.sort_by !== undefined) view.sortBy = data.sort_by
    if (data.sort_dir !== undefined) view.sortDir = data.sort_dir
    if (data.icon !== undefined) view.icon = data.icon
    if (data.color !== undefined) view.color = data.color
    if (data.is_shared !== undefined) view.isShared = data.is_shared

    await view.save()

    return ctx.response.json({ view })
  }

  /**
   * DELETE /support/agent/views/:id — Delete a saved view
   */
  async destroy(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    const viewId = ctx.params.id

    const view = await SavedView.query().where('id', viewId).where('user_id', userId).firstOrFail()

    await view.delete()

    return ctx.response.json({ success: true })
  }

  /**
   * POST /support/agent/views/reorder — Reorder saved views
   */
  async reorder(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    const { order } = ctx.request.only(['order'])

    if (!Array.isArray(order)) {
      return ctx.response.badRequest({ error: t('views.invalid_order') })
    }

    for (const [i, element] of order.entries()) {
      await SavedView.query().where('id', element).where('user_id', userId).update({ order: i })
    }

    return ctx.response.json({ success: true })
  }
}
