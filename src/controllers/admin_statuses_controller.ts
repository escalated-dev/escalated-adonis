import type { HttpContext } from '@adonisjs/core/http'
import CustomStatus from '../models/custom_status.js'
import Ticket from '../models/ticket.js'
import { escalatedDb } from '../helpers/config.js'
import { getRenderer } from '../rendering/renderer.js'
import { t } from '../support/i18n.js'
import {
  DEFAULT_STATUS_COLOR,
  STATUS_CATEGORIES,
  isStatusCategory,
  type StatusCategory,
} from '../support/custom_statuses.js'

type StatusInput = {
  label: string
  category: StatusCategory
  color: string
  description: string | null
  position: number
  isDefault: boolean
  slug: string | null
}

/**
 * Admin CRUD for custom ticket statuses. Props, validation and redirects
 * follow escalated-laravel's Admin\StatusController; the system rows (one per
 * built-in status) keep their slug and category and cannot be deleted.
 */
export default class AdminStatusesController {
  /**
   * GET /support/admin/statuses
   */
  async index(ctx: HttpContext) {
    const statuses = await CustomStatus.query()
      .orderBy('category')
      .orderBy('position')
      .orderBy('id')

    return getRenderer().render(ctx, 'Escalated/Admin/Statuses/Index', {
      statuses: statuses.map((status) => status.toAdminRow()),
      categories: [...STATUS_CATEGORIES],
    })
  }

  /**
   * GET /support/admin/statuses/create
   */
  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Statuses/Form', {
      categories: [...STATUS_CATEGORIES],
    })
  }

  /**
   * POST /support/admin/statuses
   */
  async store({ request, response, session }: HttpContext) {
    const { input, errors } = this.validate(request.all())
    if (!input) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    const slug = await CustomStatus.uniqueSlug(input.slug || input.label)
    const db = await escalatedDb()
    await db.transaction(async (trx) => {
      if (input.isDefault) {
        await CustomStatus.query({ client: trx })
          .where('category', input.category)
          .update({ isDefault: false })
      }
      await CustomStatus.create(
        {
          label: input.label,
          slug,
          category: input.category,
          color: input.color,
          description: input.description,
          position: input.position,
          isDefault: input.isDefault,
          isSystem: false,
        },
        { client: trx }
      )
    })

    session.flash('success', t('admin.status_created'))
    return response.redirect(this.indexPath(request.url()))
  }

  /**
   * GET /support/admin/statuses/:id/edit
   */
  async edit(ctx: HttpContext) {
    const status = await CustomStatus.findOrFail(ctx.params.id)

    return getRenderer().render(ctx, 'Escalated/Admin/Statuses/Form', {
      status: status.toAdminRow(),
      categories: [...STATUS_CATEGORIES],
    })
  }

  /**
   * PUT|PATCH /support/admin/statuses/:id
   *
   * Changing a status's category does not move the tickets already in it:
   * they keep the built-in status they took. Tickets that take it from now on
   * get the new category's anchor.
   */
  async update({ params, request, response, session }: HttpContext) {
    const status = await CustomStatus.findOrFail(params.id)
    const { input, errors } = this.validate(request.all())
    if (input && status.isSystem && input.category !== status.category) {
      errors.category = t('admin.status_system_category')
    }
    if (!input || Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    const slug =
      !status.isSystem && input.slug && input.slug !== status.slug
        ? await CustomStatus.uniqueSlug(input.slug, status.id)
        : status.slug

    const db = await escalatedDb()
    await db.transaction(async (trx) => {
      if (input.isDefault) {
        await CustomStatus.query({ client: trx })
          .where('category', input.category)
          .whereNot('id', status.id)
          .update({ isDefault: false })
      }
      status.useTransaction(trx)
      status.merge({
        label: input.label,
        slug,
        category: input.category,
        color: input.color,
        description: input.description,
        position: input.position,
        isDefault: input.isDefault,
      })
      await status.save()
    })

    session.flash('success', t('admin.status_updated'))
    return response.redirect(this.indexPath(request.url()))
  }

  /**
   * DELETE /support/admin/statuses/:id
   *
   * Tickets in the status keep their built-in status and lose the custom one.
   * The foreign key does that too where the database enforces it; SQLite only
   * does when asked, so it is done here as well.
   */
  async destroy({ params, request, response, session }: HttpContext) {
    const status = await CustomStatus.findOrFail(params.id)

    if (status.isSystem) {
      session.flash('error', t('admin.status_system_delete'))
      return response.redirect(this.indexPath(request.url()))
    }

    const db = await escalatedDb()
    await db.transaction(async (trx) => {
      await Ticket.query({ client: trx })
        .where('ticket_status_id', status.id)
        .update({ ticketStatusId: null })
      status.useTransaction(trx)
      await status.delete()
    })

    session.flash('success', t('admin.status_deleted'))
    return response.redirect(this.indexPath(request.url()))
  }

  // ---- Private helpers ----

  /** The statuses index, under whatever prefix the host mounted the routes at. */
  protected indexPath(url: string): string {
    return url.replace(/\/statuses(\/.*)?$/, '/statuses')
  }

  /**
   * escalated-laravel's rules: label required string max 255, category one of
   * the five, color required string max 20, description nullable string,
   * position integer, is_default boolean.
   */
  protected validate(data: Record<string, any>): {
    input: StatusInput | null
    errors: Record<string, string>
  } {
    const errors: Record<string, string> = {}

    const label = typeof data.label === 'string' ? data.label.trim() : ''
    if (!label) errors.label = 'The label field is required.'
    else if (label.length > 255) errors.label = 'The label may not be greater than 255 characters.'

    if (!isStatusCategory(data.category)) {
      errors.category = `The category must be one of: ${STATUS_CATEGORIES.join(', ')}.`
    }

    const color = typeof data.color === 'string' ? data.color.trim() : ''
    if (!color) errors.color = 'The color field is required.'
    else if (color.length > 20) errors.color = 'The color may not be greater than 20 characters.'

    let description: string | null = null
    if (data.description !== undefined && data.description !== null && data.description !== '') {
      if (typeof data.description === 'string') description = data.description
      else errors.description = 'The description must be a string.'
    }

    let position = 0
    if (data.position !== undefined && data.position !== null && data.position !== '') {
      const parsed = typeof data.position === 'number' ? data.position : Number(data.position)
      if (
        !Number.isInteger(parsed) ||
        (typeof data.position === 'string' && !/^-?\d+$/.test(data.position.trim()))
      ) {
        errors.position = 'The position must be an integer.'
      } else {
        position = parsed
      }
    }

    const isDefault = this.toBoolean(data.is_default)
    if (isDefault === undefined) errors.is_default = 'The is default field must be true or false.'

    const slug = typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim() : null

    if (Object.keys(errors).length > 0) return { input: null, errors }

    return {
      input: {
        label,
        category: data.category,
        color: color || DEFAULT_STATUS_COLOR,
        description,
        position,
        isDefault: isDefault ?? false,
        slug,
      },
      errors,
    }
  }

  /** Laravel's `boolean` rule: true, false, 1, 0, "1", "0", or absent. */
  protected toBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') return false
    if (value === true || value === 1 || value === '1' || value === 'true') return true
    if (value === false || value === 0 || value === '0' || value === 'false') return false
    return undefined
  }
}
