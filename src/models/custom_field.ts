import { type DateTime } from 'luxon'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import EscalatedBaseModel from './base_model.js'
import CustomFieldValue from './custom_field_value.js'

export const CUSTOM_FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'multi_select',
  'checkbox',
  'date',
  'number',
] as const

export const CUSTOM_FIELD_CONTEXTS = ['ticket', 'user', 'organization'] as const

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

const json = {
  prepare: (value: any) => (value === null || value === undefined ? null : JSON.stringify(value)),
  consume: (value: any) =>
    value === null || value === undefined
      ? null
      : typeof value === 'string'
        ? JSON.parse(value)
        : value,
}

/**
 * An admin-defined field on tickets, users or organizations. Mirrors
 * escalated-laravel's `CustomField` model.
 */
export default class CustomField extends EscalatedBaseModel {
  static table = 'escalated_custom_fields'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare type: CustomFieldType

  @column()
  declare context: string

  @column(json)
  declare options: string[] | null

  @column({ consume: (value: any) => Boolean(value) })
  declare required: boolean

  @column()
  declare placeholder: string | null

  @column()
  declare description: string | null

  @column({ ...json, columnName: 'validation_rules' })
  declare validationRules: Record<string, any> | any[] | null

  @column(json)
  declare conditions: Record<string, any> | any[] | null

  @column({ consume: (value: any) => Number(value ?? 0) })
  declare position: number

  @column({ consume: (value: any) => Boolean(value) })
  declare active: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => CustomFieldValue, { foreignKey: 'customFieldId' })
  declare values: HasMany<typeof CustomFieldValue>

  /** Every column, snake_case, as escalated-laravel serialises the model. */
  toAdminJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      type: this.type,
      context: this.context,
      options: this.options ?? null,
      required: Boolean(this.required),
      placeholder: this.placeholder ?? null,
      description: this.description ?? null,
      validation_rules: this.validationRules ?? null,
      conditions: this.conditions ?? null,
      position: Number(this.position ?? 0),
      active: Boolean(this.active),
      created_at: this.createdAt?.toISO() ?? null,
      updated_at: this.updatedAt?.toISO() ?? null,
    }
  }

  /** The definition a ticket form reads. */
  toDefinition() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      type: this.type,
      options: this.options ?? null,
      required: Boolean(this.required),
      placeholder: this.placeholder ?? null,
      description: this.description ?? null,
      position: Number(this.position ?? 0),
    }
  }
}
