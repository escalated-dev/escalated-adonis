import type { HttpContext } from '@adonisjs/core/http'
import CustomObject, {
  CUSTOM_OBJECT_FIELD_TYPES,
  type CustomObjectField,
} from '../models/custom_object.js'
import CustomObjectRecord from '../models/custom_object_record.js'
import { isNumeric, isValidDate } from '../services/custom_field_service.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

/**
 * Admin CRUD for custom objects and their records. Mirrors escalated-laravel's
 * `Admin\CustomObjectController`, plus validation of record `data` against the
 * object's schema (CUSTOM-FIELDS-SPEC section 3).
 */
export default class AdminCustomObjectsController {
  /** GET /admin/custom-objects */
  async index(ctx: HttpContext) {
    const objects = await CustomObject.query().withCount('records').orderBy('name', 'asc')
    return getRenderer().render(ctx, 'Escalated/Admin/CustomObjects/Index', {
      objects: objects.map((object) => ({
        ...object.toAdminJSON(),
        records_count: Number(object.$extras.records_count ?? 0),
      })),
    })
  }

  /** GET /admin/custom-objects/create */
  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/CustomObjects/Form', {})
  }

  /** POST /admin/custom-objects */
  async store({ request, response, session }: HttpContext) {
    const input = request.only(['name', 'slug', 'fields_schema'])
    const { errors, attributes } = await this.validate(input)
    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    await CustomObject.create(attributes)

    session.flash('success', 'Custom object created.')
    return redirectToRoute(response, 'escalated.admin.custom-objects.index')
  }

  /** GET /admin/custom-objects/:id/edit */
  async edit(ctx: HttpContext) {
    const object = await CustomObject.findOrFail(ctx.params.id)
    return getRenderer().render(ctx, 'Escalated/Admin/CustomObjects/Form', {
      object: object.toAdminJSON(),
    })
  }

  /** PUT/PATCH /admin/custom-objects/:id */
  async update({ params, request, response, session }: HttpContext) {
    const object = await CustomObject.findOrFail(params.id)
    const input = request.only(['name', 'slug', 'fields_schema'])
    const { errors, attributes } = await this.validate(input, object.id)
    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    object.merge(attributes)
    await object.save()

    session.flash('success', 'Custom object updated.')
    return redirectToRoute(response, 'escalated.admin.custom-objects.index')
  }

  /** DELETE /admin/custom-objects/:id — its records go with it. */
  async destroy({ params, response, session }: HttpContext) {
    const object = await CustomObject.findOrFail(params.id)
    // The foreign key cascades; deleting here as well covers SQLite
    // connections that run with foreign keys off.
    await CustomObjectRecord.query().where('object_id', object.id).delete()
    await object.delete()

    session.flash('success', 'Custom object deleted.')
    return redirectToRoute(response, 'escalated.admin.custom-objects.index')
  }

  /** GET /admin/custom-objects/:id/records — newest first. */
  async records(ctx: HttpContext) {
    const object = await CustomObject.findOrFail(ctx.params.id)
    const records = await CustomObjectRecord.query()
      .where('object_id', object.id)
      .orderBy('id', 'desc')

    return getRenderer().render(ctx, 'Escalated/Admin/CustomObjects/Records', {
      object: object.toAdminJSON(),
      records: records.map((record) => record.toAdminJSON()),
    })
  }

  /** POST /admin/custom-objects/:id/records */
  async storeRecord({ params, request, response, session }: HttpContext) {
    const object = await CustomObject.findOrFail(params.id)
    const data = request.input('data')
    const errors = this.validateRecord(object, data)
    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    await CustomObjectRecord.create({ objectId: object.id, data })

    session.flash('success', 'Record created.')
    return response.redirect().back()
  }

  /** PUT/PATCH /admin/custom-objects/:id/records/:record */
  async updateRecord({ params, request, response, session }: HttpContext) {
    const { object, record } = await this.findRecord(params)
    const data = request.input('data')
    const errors = this.validateRecord(object, data)
    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    record.data = data
    await record.save()

    session.flash('success', 'Record updated.')
    return response.redirect().back()
  }

  /** DELETE /admin/custom-objects/:id/records/:record */
  async destroyRecord({ params, response, session }: HttpContext) {
    const { record } = await this.findRecord(params)
    await record.delete()

    session.flash('success', 'Record deleted.')
    return response.redirect().back()
  }

  // ---- Helpers ----

  /** The record, only when it belongs to the object in the URL (else 404). */
  protected async findRecord(params: Record<string, any>) {
    const object = await CustomObject.findOrFail(params.id)
    const record = await CustomObjectRecord.query()
      .where('id', params.record)
      .where('object_id', object.id)
      .firstOrFail()
    return { object, record }
  }

  protected async validate(
    input: Record<string, any>,
    ignoreId?: number
  ): Promise<{ errors: Record<string, string>; attributes: Partial<CustomObject> }> {
    const errors: Record<string, string> = {}

    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) errors.name = 'The name field is required.'
    else if (name.length > 255) errors.name = 'The name must not be greater than 255 characters.'

    const slug = typeof input.slug === 'string' ? input.slug.trim() : ''
    if (!slug) errors.slug = 'The slug field is required.'
    else if (slug.length > 100) errors.slug = 'The slug must not be greater than 100 characters.'
    else if (!/^[A-Za-z0-9_-]+$/.test(slug)) {
      errors.slug = 'The slug may only contain letters, numbers, dashes and underscores.'
    } else {
      const query = CustomObject.query().where('slug', slug)
      if (ignoreId !== undefined) query.whereNot('id', ignoreId)
      if (await query.first()) errors.slug = 'The slug has already been taken.'
    }

    const schema: CustomObjectField[] = []
    if (!Array.isArray(input.fields_schema) || input.fields_schema.length === 0) {
      errors.fields_schema = 'The fields schema must have at least 1 item.'
    } else {
      input.fields_schema.forEach((raw: any, index: number) => {
        const key = `fields_schema.${index}`
        if (!isPlainObject(raw)) {
          errors[key] = 'Each field must be an object.'
          return
        }
        const fieldName = typeof raw.name === 'string' ? raw.name.trim() : ''
        if (!fieldName) errors[`${key}.name`] = 'The field name is required.'
        else if (fieldName.length > 100) {
          errors[`${key}.name`] = 'The field name must not be greater than 100 characters.'
        }
        if (!CUSTOM_OBJECT_FIELD_TYPES.includes(raw.type as any)) {
          errors[`${key}.type`] = 'The selected field type is invalid.'
        }
        if (raw.required !== undefined && typeof raw.required !== 'boolean') {
          errors[`${key}.required`] = 'The required flag must be true or false.'
        }
        if (raw.options !== undefined && !Array.isArray(raw.options)) {
          errors[`${key}.options`] = 'The options must be an array.'
        }

        const field: CustomObjectField = { name: fieldName, type: raw.type as any }
        if (raw.required !== undefined) field.required = Boolean(raw.required)
        if (Array.isArray(raw.options)) field.options = raw.options.map(String)
        schema.push(field)
      })
    }

    return { errors, attributes: { name, slug, fieldsSchema: schema } }
  }

  /** Check record `data` against the object's schema. Errors keyed `data.<name>`. */
  protected validateRecord(object: CustomObject, data: unknown): Record<string, string> {
    if (!isPlainObject(data)) return { data: 'The data field is required and must be an object.' }

    const errors: Record<string, string> = {}
    const schema = object.fieldsSchema ?? []
    const known = new Set(schema.map((field) => field.name))

    for (const key of Object.keys(data)) {
      if (!known.has(key)) errors[`data.${key}`] = `The ${key} field is not part of this object.`
    }

    for (const field of schema) {
      const key = `data.${field.name}`
      const value = data[field.name]
      if (isBlank(value)) {
        if (field.required) errors[key] = `The ${field.name} field is required.`
        continue
      }
      if (field.type === 'number' && !isNumeric(value)) {
        errors[key] = `The ${field.name} field must be a number.`
      } else if (field.type === 'date' && !isValidDate(value)) {
        errors[key] = `The ${field.name} field must be a valid date (YYYY-MM-DD).`
      } else if (
        field.type === 'select' &&
        !(Array.isArray(field.options) && field.options.map(String).includes(String(value)))
      ) {
        errors[key] = `The selected ${field.name} is invalid.`
      }
    }

    return errors
  }
}
