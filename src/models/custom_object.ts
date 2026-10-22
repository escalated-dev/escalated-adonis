import { type DateTime } from 'luxon'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import EscalatedBaseModel from './base_model.js'
import CustomObjectRecord from './custom_object_record.js'

export const CUSTOM_OBJECT_FIELD_TYPES = ['text', 'number', 'select', 'date', 'lookup'] as const

export type CustomObjectField = {
  name: string
  type: (typeof CUSTOM_OBJECT_FIELD_TYPES)[number]
  required?: boolean
  options?: string[]
}

/**
 * An admin-defined record type with its own field schema. Mirrors
 * escalated-laravel's `CustomObject` model.
 */
export default class CustomObject extends EscalatedBaseModel {
  static table = 'escalated_custom_objects'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column({
    columnName: 'fields_schema',
    prepare: (value: any) => JSON.stringify(value ?? []),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : []),
  })
  declare fieldsSchema: CustomObjectField[]

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => CustomObjectRecord, { foreignKey: 'objectId' })
  declare records: HasMany<typeof CustomObjectRecord>

  toAdminJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      fields_schema: this.fieldsSchema ?? [],
      created_at: this.createdAt?.toISO() ?? null,
      updated_at: this.updatedAt?.toISO() ?? null,
    }
  }
}
