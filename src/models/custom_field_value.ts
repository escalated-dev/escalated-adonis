import { type DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'

/**
 * One entity's value for a custom field. Tickets use `entity_type = 'ticket'`
 * and their id as a string. Mirrors escalated-laravel's `CustomFieldValue`.
 */
export default class CustomFieldValue extends EscalatedBaseModel {
  static table = 'escalated_custom_field_values'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare customFieldId: number

  @column()
  declare entityType: string

  @column({
    consume: (value: any) => (value === null || value === undefined ? value : String(value)),
  })
  declare entityId: string

  @column()
  declare value: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
