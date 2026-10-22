import { type DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'

/** One record of a custom object. Mirrors escalated-laravel's `CustomObjectRecord`. */
export default class CustomObjectRecord extends EscalatedBaseModel {
  static table = 'escalated_custom_object_records'

  @column({ isPrimary: true })
  declare id: number

  @column({ consume: (value: any) => Number(value) })
  declare objectId: number

  @column({
    prepare: (value: any) => JSON.stringify(value ?? {}),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : {}),
  })
  declare data: Record<string, any>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  toAdminJSON() {
    return {
      id: this.id,
      object_id: this.objectId,
      data: this.data ?? {},
      created_at: this.createdAt?.toISO() ?? null,
      updated_at: this.updatedAt?.toISO() ?? null,
    }
  }
}
