import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import BusinessSchedule from '../models/business_schedule.js'
import Holiday from '../models/holiday.js'
import SlaPolicy from '../models/sla_policy.js'
import Department from '../models/department.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'
import { isValidTimezone } from '../support/business_hours.js'
import { escalatedDb } from '../helpers/config.js'

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

type HolidayInput = { name: string; date: string; recurring: boolean }
type ScheduleInput = {
  name: string
  timezone: string
  is_default: boolean
  schedule: Record<string, { start: string; end: string }>
  holidays: HolidayInput[]
}

/**
 * Admin CRUD for business schedules and their holidays. Mirrors
 * escalated-laravel's `Admin\BusinessHoursController`: the same pages, props,
 * validation and redirects. Holidays are edited with their schedule; an
 * update replaces them.
 */
export default class AdminBusinessHoursController {
  async index(ctx: HttpContext) {
    const schedules = await BusinessSchedule.query()
      .orderBy('id', 'asc')
      .preload('holidays', (q) => q.orderBy('date', 'asc').orderBy('id', 'asc'))

    return getRenderer().render(ctx, 'Escalated/Admin/BusinessHours/Index', {
      schedules: schedules.map((schedule) => serializeSchedule(schedule)),
    })
  }

  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/BusinessHours/Form', {
      timezones: timezones(),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = validated(request.all())
    if ('errors' in data) {
      session.flash('errors', data.errors)
      return response.redirect().back()
    }

    const db = await escalatedDb()
    await db.transaction(async (trx) => {
      if (data.is_default) {
        await BusinessSchedule.query({ client: trx })
          .where('is_default', true)
          .update({ is_default: false })
      }
      const schedule = await BusinessSchedule.create(
        {
          name: data.name,
          timezone: data.timezone,
          isDefault: data.is_default,
          schedule: data.schedule,
        },
        { client: trx }
      )
      await createHolidays(schedule.id, data.holidays, trx)
    })

    session.flash('success', 'Business schedule created.')
    return redirectToRoute(response, 'escalated.admin.business-hours.index')
  }

  async edit(ctx: HttpContext) {
    const schedule = await BusinessSchedule.query()
      .where('id', ctx.params.id)
      .preload('holidays', (q) => q.orderBy('date', 'asc').orderBy('id', 'asc'))
      .firstOrFail()

    return getRenderer().render(ctx, 'Escalated/Admin/BusinessHours/Form', {
      schedule: serializeSchedule(schedule),
      timezones: timezones(),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const schedule = await BusinessSchedule.findOrFail(params.id)
    const data = validated(request.all())
    if ('errors' in data) {
      session.flash('errors', data.errors)
      return response.redirect().back()
    }

    const db = await escalatedDb()
    await db.transaction(async (trx) => {
      if (data.is_default) {
        await BusinessSchedule.query({ client: trx })
          .where('is_default', true)
          .whereNot('id', schedule.id)
          .update({ is_default: false })
      }
      schedule.useTransaction(trx)
      schedule.merge({
        name: data.name,
        timezone: data.timezone,
        isDefault: data.is_default,
        schedule: data.schedule,
      })
      await schedule.save()

      await Holiday.query({ client: trx }).where('schedule_id', schedule.id).delete()
      await createHolidays(schedule.id, data.holidays, trx)
    })

    session.flash('success', 'Business schedule updated.')
    return redirectToRoute(response, 'escalated.admin.business-hours.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const schedule = await BusinessSchedule.findOrFail(params.id)

    // SQLite does not enforce the cascade unless foreign keys are on, and the
    // policy and department references are plain columns: clear them here.
    await Holiday.query().where('schedule_id', schedule.id).delete()
    await SlaPolicy.query()
      .where('business_schedule_id', schedule.id)
      .update({ business_schedule_id: null })
    await Department.query()
      .where('business_schedule_id', schedule.id)
      .update({ business_schedule_id: null })
    await schedule.delete()

    session.flash('success', 'Business schedule deleted.')
    return redirectToRoute(response, 'escalated.admin.business-hours.index')
  }
}

// ---- Helpers ----

async function createHolidays(scheduleId: number, holidays: HolidayInput[], trx: any) {
  for (const holiday of holidays) {
    await Holiday.create({ scheduleId, ...holiday }, { client: trx })
  }
}

function serializeSchedule(schedule: BusinessSchedule) {
  return {
    id: schedule.id,
    name: schedule.name,
    timezone: schedule.timezone,
    is_default: Boolean(schedule.isDefault),
    schedule: schedule.schedule ?? {},
    holidays: (schedule.holidays ?? []).map((holiday) => ({
      id: holiday.id,
      schedule_id: holiday.scheduleId,
      name: holiday.name,
      date: holiday.date,
      recurring: Boolean(holiday.recurring),
      created_at: holiday.createdAt?.toISO() ?? null,
      updated_at: holiday.updatedAt?.toISO() ?? null,
    })),
    created_at: schedule.createdAt?.toISO() ?? null,
    updated_at: schedule.updatedAt?.toISO() ?? null,
  }
}

/** Every IANA zone the runtime knows, as PHP's `timezone_identifiers_list()`. */
export function timezones(): string[] {
  const zones = new Set<string>((Intl as any).supportedValuesOf?.('timeZone') ?? [])
  zones.add('UTC')
  return [...zones].sort()
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'on'
}

function isClock(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false
  const h = Number(match[1])
  const m = Number(match[2])
  return m <= 59 && (h < 24 || (h === 24 && m === 0))
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return DateTime.fromISO(value, { zone: 'UTC' }).isValid
}

/** The request's schedule, or the field errors to show. */
function validated(input: Record<string, any>): ScheduleInput | { errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) errors.name = 'The name field is required.'
  else if (name.length > 255) errors.name = 'The name may not be longer than 255 characters.'

  const timezone = typeof input.timezone === 'string' ? input.timezone : ''
  if (!timezone) errors.timezone = 'The timezone field is required.'
  else if (!isValidTimezone(timezone)) errors.timezone = 'The timezone must be a valid zone.'

  const schedule: Record<string, { start: string; end: string }> = {}
  const raw = input.schedule
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.schedule = 'The schedule field is required.'
  } else {
    for (const day of WEEKDAYS) {
      const hours = raw[day]
      if (hours === undefined || hours === null) continue
      const start = typeof hours?.start === 'string' ? hours.start : ''
      const end = typeof hours?.end === 'string' ? hours.end : ''
      if ((start && !isClock(start)) || (end && !isClock(end))) {
        errors.schedule = `The ${day} hours must be times like 09:00.`
        break
      }
      schedule[day] = { start, end }
    }
  }

  const holidays: HolidayInput[] = []
  const rawHolidays = input.holidays ?? []
  if (!Array.isArray(rawHolidays)) {
    errors.holidays = 'The holidays field must be a list.'
  } else {
    rawHolidays.forEach((holiday: any, index: number) => {
      const holidayName = typeof holiday?.name === 'string' ? holiday.name.trim() : ''
      const date = typeof holiday?.date === 'string' ? holiday.date.slice(0, 10) : ''
      if (!holidayName) errors[`holidays.${index}.name`] = 'The holiday name is required.'
      else if (holidayName.length > 255)
        errors[`holidays.${index}.name`] = 'The holiday name may not be longer than 255 characters.'
      if (!isDate(date)) errors[`holidays.${index}.date`] = 'The holiday date must be a valid date.'
      holidays.push({ name: holidayName, date, recurring: bool(holiday?.recurring) })
    })
  }

  if (Object.keys(errors).length > 0) return { errors }

  return { name, timezone, is_default: bool(input.is_default), schedule, holidays }
}
