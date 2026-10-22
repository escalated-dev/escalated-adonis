import { DateTime, IANAZone } from 'luxon'

/*
|--------------------------------------------------------------------------
| Business hours calculator
|--------------------------------------------------------------------------
|
| escalated-laravel's BusinessHoursCalculator, counted in minutes.
|
| Opening hours are wall-clock times in the schedule's time zone, but time is
| counted in real elapsed minutes, so a window on a daylight-saving change day
| is an hour shorter or longer than its wall-clock span. A window belongs to
| the local date it opens on: a holiday on that date closes it, overnight part
| included. `24:00` is the next midnight; an end before the start is an
| overnight window; an equal start and end is closed. A schedule with no usable
| window falls back to calendar time, so a policy never loses its deadline.
|
*/

export type DayHours = { start?: string | null; end?: string | null } | null | undefined

export type BusinessHoursSchedule = {
  timezone?: string | null
  schedule: Record<string, DayHours> | null | undefined
  holidays?: Array<{ date: string; recurring?: boolean | null }> | null
}

/** A schedule whose windows are all closed by holidays for ten years has no hours. */
const MAX_SCAN_DAYS = 3660

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** The instant `minutes` of business time after `from`. */
export function addBusinessMinutes(
  from: Date,
  minutes: number,
  schedule: BusinessHoursSchedule
): Date {
  let remaining = Math.round(minutes * 60_000)
  if (!(remaining > 0)) return new Date(from.getTime())

  const calendar = new Date(from.getTime() + remaining)
  if (!hasOpenDay(schedule)) return calendar

  const zone = zoneOf(schedule)
  let cursor = from.getTime()
  // Start a day early: an overnight window opened yesterday may still be open.
  let day: DateTime = DateTime.fromMillis(cursor, { zone }).startOf('day').minus({ days: 1 })

  for (let i = 0; i < MAX_SCAN_DAYS; i++) {
    const win = windowOn(day, schedule, zone)
    if (win && win.end > cursor) {
      const start = Math.max(win.start, cursor)
      const available = win.end - start
      if (remaining <= available) return new Date(start + remaining)
      remaining -= available
      cursor = win.end
    }
    day = nextDay(day)
  }

  return calendar
}

/** Whether `at` falls inside one of the schedule's opening windows. */
export function isWithinBusinessHours(at: Date, schedule: BusinessHoursSchedule): boolean {
  const zone = zoneOf(schedule)
  const instant = at.getTime()
  const today = DateTime.fromMillis(instant, { zone }).startOf('day')

  for (const day of [today.minus({ days: 1 }), today]) {
    const win = windowOn(day, schedule, zone)
    if (win && instant >= win.start && instant < win.end) return true
  }
  return false
}

/** Whether a time zone name is one the calculator can use. */
export function isValidTimezone(name: unknown): name is string {
  return typeof name === 'string' && name !== '' && IANAZone.isValidZone(name)
}

// ---- Internals ----

function zoneOf(schedule: BusinessHoursSchedule): string {
  return isValidTimezone(schedule.timezone) ? schedule.timezone : 'UTC'
}

function hasOpenDay(schedule: BusinessHoursSchedule): boolean {
  return WEEKDAYS.some((key) => bounds(schedule.schedule?.[key]) !== null)
}

/** The next calendar date, at its local midnight. */
function nextDay(day: DateTime): DateTime {
  return day.plus({ days: 1 }).startOf('day')
}

/**
 * The opening window that starts on the local date `day`, as epoch
 * milliseconds, or null when that date is closed or a holiday.
 */
function windowOn(
  day: DateTime,
  schedule: BusinessHoursSchedule,
  zone: string
): { start: number; end: number } | null {
  const hours = bounds(schedule.schedule?.[WEEKDAYS[day.weekday - 1]])
  if (!hours) return null
  if (isHoliday(day, schedule)) return null

  const start = wallClock(day, hours.start, zone)
  const endDay = hours.end <= hours.start ? day.plus({ days: 1 }) : day
  const end = wallClock(endDay, hours.end, zone)
  return end > start ? { start, end } : null
}

function isHoliday(day: DateTime, schedule: BusinessHoursSchedule): boolean {
  const date = day.toISODate()!
  const monthDay = date.slice(5)
  return (schedule.holidays ?? []).some((holiday) => {
    const value = String(holiday?.date ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    return holiday.recurring ? value.slice(5) === monthDay : value === date
  })
}

/** A day's start and end in minutes after midnight, or null when closed. */
function bounds(hours: DayHours): { start: number; end: number } | null {
  if (!hours) return null
  const start = clockMinutes(hours.start)
  const end = clockMinutes(hours.end)
  if (start === null || end === null || start >= 24 * 60 || start === end) return null
  return { start, end }
}

/** Parses "HH:MM", 00:00 to 24:00. */
function clockMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null
  return h * 60 + m
}

/**
 * The instant the clock in `zone` reads `minutes` past midnight on the local
 * date `day`. 1440 is the next midnight. A wall time skipped by a
 * daylight-saving change resolves to the moment the clocks go forward.
 */
function wallClock(day: DateTime, minutes: number, zone: string): number {
  let date = day
  let offset = minutes
  if (offset >= 24 * 60) {
    date = day.plus({ days: 1 })
    offset -= 24 * 60
  }
  const wanted = { year: date.year, month: date.month, day: date.day }
  const hour = Math.floor(offset / 60)
  const minute = offset % 60
  const t = DateTime.fromObject({ ...wanted, hour, minute }, { zone })
  if (t.hour === hour && t.minute === minute && t.day === wanted.day) return t.toMillis()

  // In a gap, Luxon moves the wall time forward by the size of the jump. Walk
  // back to the first instant whose wall time is not before the one asked for:
  // the moment of the change.
  const label = (d: DateTime) => d.toFormat('yyyy-MM-dd HH:mm')
  const target = label(DateTime.fromObject({ ...wanted, hour, minute }, { zone: 'UTC' }))
  let instant = t
  for (let i = 0; i < 24 * 60; i++) {
    const previous = instant.minus({ minutes: 1 })
    if (label(previous) < target) break
    instant = previous
  }
  return instant.startOf('minute').toMillis()
}
