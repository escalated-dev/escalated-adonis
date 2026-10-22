import { type DateTime } from 'luxon'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import EscalatedBaseModel from './base_model.js'
import Holiday from './holiday.js'
import type { BusinessHoursSchedule, DayHours } from '../support/business_hours.js'

/**
 * Working hours in a time zone, with the holidays they close for. Mirrors
 * escalated-laravel's BusinessSchedule; SlaService counts business-hours
 * deadlines against one when a policy is limited to business hours.
 */
export default class BusinessSchedule extends EscalatedBaseModel {
  static table = 'escalated_business_schedules'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare timezone: string

  @column({ consume: (value: unknown) => Boolean(value) })
  declare isDefault: boolean

  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? {}),
    consume: (value: unknown) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : {},
  })
  declare schedule: Record<string, DayHours>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Holiday, { foreignKey: 'scheduleId' })
  declare holidays: HasMany<typeof Holiday>

  /** The shape the calculator reads; `holidays` must be preloaded. */
  toCalculatorSchedule(): BusinessHoursSchedule {
    return {
      timezone: this.timezone,
      schedule: this.schedule,
      holidays: (this.holidays ?? []).map((h) => ({ date: h.date, recurring: h.recurring })),
    }
  }
}
