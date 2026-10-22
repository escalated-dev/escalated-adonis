import type { HttpContext } from '@adonisjs/core/http'
import CustomField, { CUSTOM_FIELD_CONTEXTS, CUSTOM_FIELD_TYPES } from '../models/custom_field.js'
import CustomFieldValue from '../models/custom_field_value.js'
import CustomFieldService from '../services/custom_field_service.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'

const FIELDS = [
  'name',
  'slug',
  'type',
  'context',
  'options',
  'required',
  'placeholder',
  'description',
  'validation_rules',
  'conditions',
  'position',
  'active',
] as const

type Input = Partial<Record<(typeof FIELDS)[number], any>>

function toBool(value: unknown): boolean | null {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') {
    return true
  }
  if (value === false || value === 0 || value === '0' || value === 'false' || value === '') {
    return false
  }
  return null
}

/**
 * Admin CRUD for custom field definitions. Mirrors escalated-laravel's
 * `Admin\CustomFieldController`: the same routes, page props, rules and
 * flash messages.
 */
export default class AdminCustomFieldsController {
  protected service = new CustomFieldService()

  /** GET /admin/custom-fields */
  async index(ctx: HttpContext) {
    const fields = await CustomField.query().orderBy('position', 'asc').orderBy('id', 'asc')
    return getRenderer().render(ctx, 'Escalated/Admin/CustomFields/Index', {
      fields: fields.map((field) => field.toAdminJSON()),
    })
  }

  /** GET /admin/custom-fields/create */
  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/CustomFields/Form', {
      contexts: [...CUSTOM_FIELD_CONTEXTS],
    })
  }

  /** POST /admin/custom-fields */
  async store({ request, response, session }: HttpContext) {
    const input = request.only([...FIELDS]) as Input
    const { errors, attributes } = this.validate(input)
    if (input.slug && !errors.slug) {
      const taken = await CustomField.query().where('slug', String(input.slug)).first()
      if (taken) errors.slug = 'The slug has already been taken.'
    }
    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    await CustomField.create({
      context: 'ticket',
      required: false,
      active: true,
      position: 0,
      ...attributes,
      slug: await this.service.uniqueSlug(attributes.name!, input.slug),
    })

    session.flash('success', 'Custom field created.')
    return redirectToRoute(response, 'escalated.admin.custom-fields.index')
  }

  /** GET /admin/custom-fields/:id/edit */
  async edit(ctx: HttpContext) {
    const field = await CustomField.findOrFail(ctx.params.id)
    return getRenderer().render(ctx, 'Escalated/Admin/CustomFields/Form', {
      field: field.toAdminJSON(),
      contexts: [...CUSTOM_FIELD_CONTEXTS],
    })
  }

  /** PUT/PATCH /admin/custom-fields/:id */
  async update({ params, request, response, session }: HttpContext) {
    const field = await CustomField.findOrFail(params.id)
    const input = request.only([...FIELDS]) as Input
    const { errors, attributes } = this.validate({
      context: field.context,
      ...input,
    })
    if (input.slug && !errors.slug) {
      const taken = await CustomField.query()
        .where('slug', String(input.slug))
        .whereNot('id', field.id)
        .first()
      if (taken) errors.slug = 'The slug has already been taken.'
    }
    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    field.merge(attributes)
    if (input.slug) field.slug = String(input.slug)
    await field.save()

    session.flash('success', 'Custom field updated.')
    return redirectToRoute(response, 'escalated.admin.custom-fields.index')
  }

  /** DELETE /admin/custom-fields/:id — its values go with it. */
  async destroy({ params, response, session }: HttpContext) {
    const field = await CustomField.findOrFail(params.id)
    // The foreign key cascades; deleting here as well covers SQLite
    // connections that run with foreign keys off.
    await CustomFieldValue.query().where('custom_field_id', field.id).delete()
    await field.delete()

    session.flash('success', 'Custom field deleted.')
    return redirectToRoute(response, 'escalated.admin.custom-fields.index')
  }

  /** POST /admin/custom-fields/reorder — `positions: [{id, position}]`. */
  async reorder({ request, response, session }: HttpContext) {
    const positions = request.input('positions')
    const valid =
      Array.isArray(positions) &&
      positions.every(
        (item) =>
          item &&
          Number.isInteger(Number(item.id)) &&
          Number.isInteger(Number(item.position)) &&
          item.position !== null &&
          item.position !== ''
      )
    if (!valid) {
      session.flash('errors', {
        positions: 'The positions field must be a list of {id, position}.',
      })
      return response.redirect().back()
    }

    const ids = positions.map((item: any) => Number(item.id))
    const found = await CustomField.query().whereIn('id', ids)
    if (found.length !== new Set(ids).size) {
      session.flash('errors', { positions: 'The selected field is invalid.' })
      return response.redirect().back()
    }

    for (const item of positions) {
      await CustomField.query()
        .where('id', Number(item.id))
        .update({ position: Number(item.position) })
    }

    session.flash('success', 'Fields reordered.')
    return response.redirect().back()
  }

  // ---- Validation (escalated-laravel's rules) ----

  protected validate(input: Input): {
    errors: Record<string, string>
    attributes: Partial<CustomField>
  } {
    const errors: Record<string, string> = {}
    const attributes: Record<string, any> = {}

    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) errors.name = 'The name field is required.'
    else if (name.length > 255) errors.name = 'The name must not be greater than 255 characters.'
    else attributes.name = name

    if (!CUSTOM_FIELD_TYPES.includes(input.type)) errors.type = 'The selected type is invalid.'
    else attributes.type = input.type

    const context = input.context ?? 'ticket'
    if (!CUSTOM_FIELD_CONTEXTS.includes(context)) {
      errors.context = 'The selected context is invalid.'
    } else attributes.context = context

    if (input.slug !== undefined && input.slug !== null && input.slug !== '') {
      if (typeof input.slug !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(input.slug)) {
        errors.slug = 'The slug may only contain letters, numbers, dashes and underscores.'
      }
    }

    if (input.options !== undefined) {
      if (input.options === null) attributes.options = null
      else if (!Array.isArray(input.options)) errors.options = 'The options must be an array.'
      else {
        attributes.options = input.options
          .map((option: unknown) => (option === null || option === undefined ? '' : String(option)))
          .map((option: string) => option.trim())
          .filter((option: string) => option !== '')
      }
    }
    if (
      (input.type === 'select' || input.type === 'multi_select') &&
      !errors.options &&
      (!Array.isArray(attributes.options) || attributes.options.length === 0)
    ) {
      errors.options = 'Select fields need at least one option.'
    }

    for (const key of ['required', 'active'] as const) {
      if (input[key] === undefined) continue
      const value = toBool(input[key])
      if (value === null) errors[key] = `The ${key} field must be true or false.`
      else attributes[key] = value
    }

    if (input.placeholder !== undefined) {
      if (input.placeholder === null || input.placeholder === '') attributes.placeholder = null
      else if (typeof input.placeholder !== 'string') {
        errors.placeholder = 'The placeholder must be a string.'
      } else if (input.placeholder.length > 255) {
        errors.placeholder = 'The placeholder must not be greater than 255 characters.'
      } else attributes.placeholder = input.placeholder
    }

    if (input.description !== undefined) {
      if (input.description === null || input.description === '') attributes.description = null
      else if (typeof input.description !== 'string') {
        errors.description = 'The description must be a string.'
      } else attributes.description = input.description
    }

    if (input.validation_rules !== undefined) {
      if (input.validation_rules === null) attributes.validationRules = null
      else if (typeof input.validation_rules !== 'object') {
        errors.validation_rules = 'The validation rules must be an array.'
      } else attributes.validationRules = input.validation_rules
    }

    if (input.conditions !== undefined) {
      if (input.conditions === null) attributes.conditions = null
      else if (typeof input.conditions !== 'object') {
        errors.conditions = 'The conditions must be an array.'
      } else attributes.conditions = input.conditions
    }

    if (input.position !== undefined && input.position !== null && input.position !== '') {
      const position = Number(input.position)
      if (!Number.isInteger(position)) errors.position = 'The position must be an integer.'
      else attributes.position = position
    }

    return { errors, attributes: attributes as Partial<CustomField> }
  }
}
