import string from '@adonisjs/core/helpers/string'
import CustomField from '../models/custom_field.js'
import CustomFieldValue from '../models/custom_field_value.js'

/*
|--------------------------------------------------------------------------
| Ticket custom field values
|--------------------------------------------------------------------------
|
| The shared contract every port follows: ticket create and update endpoints
| take an optional `custom_fields` object keyed by field slug. Only active
| fields with `context = ticket` count, and values are checked before the
| ticket is written. Values are stored as text: multi_select as a JSON array,
| checkbox as "1"/"0", everything else as given.
|
*/

export const TICKET_ENTITY = 'ticket'

export type CustomFieldMode = 'create' | 'update'

/** A validated value to write: a string to store, or null to delete. */
export type PendingValues = Array<{ field: CustomField; value: string | null }>

export type CustomFieldCheck = {
  /** Messages keyed `custom_fields.<slug>` (or `custom_fields` for a bad shape). */
  errors: Record<string, string>
  values: PendingValues
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const NUMBER = /^-?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const match = DATE.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && NUMBER.test(value.trim())
}

function checkboxValue(value: unknown): '1' | '0' | null {
  if (value === true || value === 1 || value === '1' || value === 'true') return '1'
  if (value === false || value === 0 || value === '0' || value === 'false') return '0'
  return null
}

/**
 * Check one non-empty value against its field. Returns the string to store,
 * or an error message.
 */
function encode(field: CustomField, value: unknown): { value: string } | { error: string } {
  const label = field.name
  const options = Array.isArray(field.options) ? field.options.map(String) : []

  switch (field.type) {
    case 'number':
      return isNumeric(value)
        ? { value: String(value).trim() }
        : { error: `The ${label} field must be a number.` }
    case 'date':
      return isValidDate(value)
        ? { value: value as string }
        : { error: `The ${label} field must be a valid date (YYYY-MM-DD).` }
    case 'checkbox': {
      const encoded = checkboxValue(value)
      return encoded === null
        ? { error: `The ${label} field must be true or false.` }
        : { value: encoded }
    }
    case 'select':
      return typeof value === 'string' && options.includes(value)
        ? { value }
        : { error: `The selected ${label} is invalid.` }
    case 'multi_select': {
      if (!Array.isArray(value)) return { error: `The ${label} field must be an array.` }
      const chosen = value.map((v) => (typeof v === 'string' ? v : null))
      if (chosen.some((v) => v === null || !options.includes(v))) {
        return { error: `The selected ${label} is invalid.` }
      }
      return { value: JSON.stringify(chosen) }
    }
    case 'textarea':
      return typeof value === 'string'
        ? { value }
        : { error: `The ${label} field must be a string.` }
    case 'text':
    default:
      if (typeof value !== 'string') return { error: `The ${label} field must be a string.` }
      return value.length > 255
        ? { error: `The ${label} field must not be greater than 255 characters.` }
        : { value }
  }
}

/** Turn a stored string back into the value a page or API client reads. */
export function decodeValue(field: CustomField, raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined) return null
  switch (field.type) {
    case 'multi_select':
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        return [raw]
      }
    case 'checkbox':
      return raw === '1' || raw === 'true'
    case 'number': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : raw
    }
    default:
      return raw
  }
}

export default class CustomFieldService {
  /** Active ticket-context fields, ordered by position. */
  async ticketFields(): Promise<CustomField[]> {
    return CustomField.query()
      .where('context', 'ticket')
      .where('active', true)
      .orderBy('position', 'asc')
      .orderBy('id', 'asc')
  }

  /** The `custom_fields` prop of a ticket create page. */
  async ticketDefinitions() {
    const fields = await this.ticketFields()
    return fields.map((field) => field.toDefinition())
  }

  /**
   * Validate the `custom_fields` input of a ticket create or update.
   *
   * On create every required field must be present and non-empty. On update
   * only the keys that are sent are checked, and an omitted `custom_fields`
   * changes nothing.
   */
  async validateTicketInput(input: unknown, mode: CustomFieldMode): Promise<CustomFieldCheck> {
    const errors: Record<string, string> = {}
    const values: PendingValues = []

    if (input === undefined || input === null) {
      if (mode === 'update') return { errors, values }
      input = {}
    }
    if (!isPlainObject(input)) {
      return { errors: { custom_fields: 'The custom fields must be an object.' }, values }
    }

    const fields = await this.ticketFields()
    const bySlug = new Map(fields.map((field) => [field.slug, field]))

    for (const key of Object.keys(input)) {
      if (!bySlug.has(key)) errors[`custom_fields.${key}`] = 'The selected custom field is invalid.'
    }

    for (const field of fields) {
      const key = `custom_fields.${field.slug}`
      const present = Object.prototype.hasOwnProperty.call(input, field.slug)
      const value = present ? (input as Record<string, unknown>)[field.slug] : undefined

      if (isEmpty(value)) {
        if (field.required && (mode === 'create' || present)) {
          errors[key] = `The ${field.name} field is required.`
        } else if (present) {
          values.push({ field, value: null })
        }
        continue
      }

      const result = encode(field, value)
      if ('error' in result) errors[key] = result.error
      else values.push({ field, value: result.value })
    }

    return { errors, values }
  }

  /** Write validated values for a ticket: null deletes, anything else upserts. */
  async saveTicketValues(ticketId: number | string, values: PendingValues): Promise<void> {
    const entityId = String(ticketId)
    for (const { field, value } of values) {
      const existing = await CustomFieldValue.query()
        .where('custom_field_id', field.id)
        .where('entity_type', TICKET_ENTITY)
        .where('entity_id', entityId)
        .first()

      if (value === null) {
        if (existing) await existing.delete()
      } else if (existing) {
        existing.value = value
        await existing.save()
      } else {
        await CustomFieldValue.create({
          customFieldId: field.id,
          entityType: TICKET_ENTITY,
          entityId,
          value,
        })
      }
    }
  }

  /** The `custom_fields` of a ticket show page or API detail: definitions plus `value`. */
  async ticketValues(ticketId: number | string) {
    const fields = await this.ticketFields()
    if (fields.length === 0) return []

    const rows = await CustomFieldValue.query()
      .where('entity_type', TICKET_ENTITY)
      .where('entity_id', String(ticketId))
      .whereIn(
        'custom_field_id',
        fields.map((field) => field.id)
      )
    const byField = new Map(rows.map((row) => [Number(row.customFieldId), row.value]))

    return fields.map((field) => ({
      ...field.toDefinition(),
      value: decodeValue(field, byField.get(field.id)),
    }))
  }

  /** Delete every stored value of a ticket. */
  async deleteTicketValues(ticketId: number | string): Promise<void> {
    await CustomFieldValue.query()
      .where('entity_type', TICKET_ENTITY)
      .where('entity_id', String(ticketId))
      .delete()
  }

  /**
   * The slug for a new field: the given one, or the name with `_` separators,
   * suffixed `_2`, `_3`... when taken.
   */
  async uniqueSlug(name: string, explicit?: string | null, ignoreId?: number): Promise<string> {
    const seed = explicit && explicit.trim() !== '' ? explicit : name
    const base = string.slug(seed, { replacement: '_', lower: true, strict: true }) || 'field'

    let candidate = base
    for (let n = 2; ; n++) {
      const query = CustomField.query().where('slug', candidate)
      if (ignoreId !== undefined) query.whereNot('id', ignoreId)
      if (!(await query.first())) return candidate
      candidate = `${base}_${n}`
    }
  }
}

/** Errors as an API returns them: each key mapped to a list of messages. */
export function asApiErrors(errors: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(errors).map(([key, message]) => [key, [message]]))
}
