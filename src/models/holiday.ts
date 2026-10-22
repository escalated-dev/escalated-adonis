import { type DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import EscalatedBaseModel from './base_model.js'
import BusinessSchedule from './business_schedule.js'

/**
 * A day a business schedule is closed. `date` is kept as "YYYY-MM-DD"
 * whatever the driver hands back: pg and mysql2 read a DATE column as a
 * Date at local midnight, SQLite as the stored string.
 */
export function toDateString(value: unknown): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  if (value && typeof (value as any).toISODate === 'function') {
    return (value as any).toISODate()
  }
  return String(value ?? '').slice(0, 10)
}

export default class Holiday extends EscalatedBaseModel {
  static table = 'escalated_holidays'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare scheduleId: number

  @column()
  declare name: string

  @column({ prepare: (value: unknown) => toDateString(value), consume: toDateString })
  declare date: string

  @column({ consume: (value: unknown) => Boolean(value) })
  declare recurring: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => BusinessSchedule, { foreignKey: 'scheduleId' })
  declare schedule: BelongsTo<typeof BusinessSchedule>
}
