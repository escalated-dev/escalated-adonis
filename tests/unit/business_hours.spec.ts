import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  addBusinessMinutes,
  isWithinBusinessHours,
  type BusinessHoursSchedule,
} from '../../src/support/business_hours.ts'

const nineToFive = { start: '09:00', end: '17:00' }
const closed = { start: '', end: '' }

function schedule(overrides: Partial<BusinessHoursSchedule> = {}): BusinessHoursSchedule {
  return {
    timezone: 'UTC',
    schedule: {
      monday: nineToFive,
      tuesday: nineToFive,
      wednesday: nineToFive,
      thursday: nineToFive,
      friday: nineToFive,
      saturday: closed,
      sunday: closed,
    },
    holidays: [],
    ...overrides,
  }
}

const at = (iso: string) => new Date(iso)
const add = (s: BusinessHoursSchedule, from: string, minutes: number) =>
  addBusinessMinutes(at(from), minutes, s).toISOString()

describe('business hours calculator', () => {
  it('adds minutes inside one open window', () => {
    // 2026-10-19 is a Monday.
    assert.equal(add(schedule(), '2026-10-19T10:00:00Z', 120), '2026-10-19T12:00:00.000Z')
  })

  it('carries what is left over into the next open day', () => {
    assert.equal(add(schedule(), '2026-10-19T16:00:00Z', 120), '2026-10-20T10:00:00.000Z')
  })

  it('skips the weekend', () => {
    // Friday 16:00 + 2h -> Monday 10:00.
    assert.equal(add(schedule(), '2026-10-23T16:00:00Z', 120), '2026-10-26T10:00:00.000Z')
  })

  it('starts counting at the next opening when created after hours', () => {
    // Friday 20:00 -> Monday 09:00 + 1h.
    assert.equal(add(schedule(), '2026-10-23T20:00:00Z', 60), '2026-10-26T10:00:00.000Z')
    // Saturday -> Monday.
    assert.equal(add(schedule(), '2026-10-24T12:00:00Z', 30), '2026-10-26T09:30:00.000Z')
  })

  it('skips a one-off holiday', () => {
    const s = schedule({ holidays: [{ date: '2026-10-20', recurring: false }] })
    // Monday 16:00 + 2h: Tuesday is a holiday, so Wednesday 10:00.
    assert.equal(add(s, '2026-10-19T16:00:00Z', 120), '2026-10-21T10:00:00.000Z')
    // The same date in another year is an ordinary day.
    assert.equal(add(s, '2027-10-19T16:00:00Z', 120), '2027-10-20T10:00:00.000Z')
  })

  it('skips a recurring holiday every year', () => {
    const s = schedule({ holidays: [{ date: '2020-12-25', recurring: true }] })
    // Thursday 2026-12-24 16:00 + 2h: Friday the 25th is off, so Monday the 28th 10:00.
    assert.equal(add(s, '2026-12-24T16:00:00Z', 120), '2026-12-28T10:00:00.000Z')
  })

  it('counts an overnight window that crosses midnight', () => {
    const s = schedule({
      schedule: {
        monday: { start: '22:00', end: '06:00' },
        tuesday: { start: '22:00', end: '06:00' },
      },
    })
    // Monday 23:00 + 3h -> Tuesday 02:00, inside the window Monday opened.
    assert.equal(add(s, '2026-10-19T23:00:00Z', 180), '2026-10-20T02:00:00.000Z')
    // Tuesday 01:00 is still inside that window: 5h of it left, then Tuesday 22:00.
    assert.equal(add(s, '2026-10-20T01:00:00Z', 360), '2026-10-20T23:00:00.000Z')
  })

  it('closes the overnight window that opens on a holiday', () => {
    const s = schedule({
      schedule: {
        monday: { start: '22:00', end: '06:00' },
        tuesday: { start: '22:00', end: '06:00' },
      },
      holidays: [{ date: '2026-10-19', recurring: false }],
    })
    assert.equal(add(s, '2026-10-19T23:00:00Z', 60), '2026-10-20T23:00:00.000Z')
  })

  it('treats 24:00 as the next midnight', () => {
    const s = schedule({ schedule: { monday: { start: '20:00', end: '24:00' } } })
    assert.equal(add(s, '2026-10-19T22:00:00Z', 120), '2026-10-20T00:00:00.000Z')
    // Monday 22:00 + 3h: 2h left on Monday, then the next Monday 21:00.
    assert.equal(add(s, '2026-10-19T22:00:00Z', 180), '2026-10-26T21:00:00.000Z')
  })

  it('reads the hours in the schedule time zone', () => {
    const s = schedule({ timezone: 'America/Toronto' })
    // 12:00Z is 08:00 in Toronto (EDT, UTC-4); it opens at 09:00 = 13:00Z.
    assert.equal(add(s, '2026-10-19T12:00:00Z', 60), '2026-10-19T14:00:00.000Z')
    // Friday 20:30Z = 16:30 local: 30 min on Friday, 30 min from Monday 13:00Z.
    assert.equal(add(s, '2026-10-23T20:30:00Z', 60), '2026-10-26T13:30:00.000Z')
  })

  it('uses the local date for weekdays and holidays, not the UTC one', () => {
    const s = schedule({
      timezone: 'Asia/Tokyo',
      holidays: [{ date: '2026-10-20', recurring: false }],
    })
    // 2026-10-19T23:00Z is Tuesday 08:00 in Tokyo, a holiday: Wednesday 09:00 JST = 00:00Z.
    assert.equal(add(s, '2026-10-19T23:00:00Z', 60), '2026-10-21T01:00:00.000Z')
  })

  it('counts real minutes across the spring-forward change', () => {
    // Sunday 2026-03-08 America/New_York jumps from 02:00 to 03:00.
    const s = schedule({
      timezone: 'America/New_York',
      schedule: { sunday: { start: '00:00', end: '06:00' }, monday: nineToFive },
    })
    // 00:00 EST (05:00Z) to 06:00 EDT (10:00Z) is 5 real hours.
    assert.equal(add(s, '2026-03-08T05:00:00Z', 300), '2026-03-08T10:00:00.000Z')
    // A sixth hour lands in Monday from 09:00 EDT (13:00Z).
    assert.equal(add(s, '2026-03-08T05:00:00Z', 360), '2026-03-09T14:00:00.000Z')
  })

  it('opens at the clock change when the opening time does not exist', () => {
    const s = schedule({
      timezone: 'America/New_York',
      schedule: { sunday: { start: '02:30', end: '04:00' } },
    })
    // 02:30 is skipped: the window opens at 03:00 EDT (07:00Z) and closes 04:00 EDT.
    assert.equal(add(s, '2026-03-08T00:00:00Z', 30), '2026-03-08T07:30:00.000Z')
    assert.equal(add(s, '2026-03-08T00:00:00Z', 60), '2026-03-08T08:00:00.000Z')
  })

  it('counts real minutes across the fall-back change', () => {
    // Sunday 2026-11-01 America/New_York repeats 01:00-02:00.
    const s = schedule({
      timezone: 'America/New_York',
      schedule: { sunday: { start: '00:00', end: '03:00' }, monday: nineToFive },
    })
    // 00:00 EDT (04:00Z) to 03:00 EST (08:00Z) is 4 real hours.
    assert.equal(add(s, '2026-11-01T04:00:00Z', 240), '2026-11-01T08:00:00.000Z')
    // Monday opens at 09:00 EST = 14:00Z.
    assert.equal(add(s, '2026-11-01T04:00:00Z', 270), '2026-11-02T14:30:00.000Z')
  })

  it('falls back to calendar time when no day is open', () => {
    const s = schedule({
      schedule: { monday: closed, tuesday: { start: '09:00', end: '09:00' } },
    })
    assert.equal(add(s, '2026-10-19T10:00:00Z', 90), '2026-10-19T11:30:00.000Z')
  })

  it('falls back to UTC for an unknown time zone', () => {
    const s = schedule({ timezone: 'Not/AZone' })
    assert.equal(add(s, '2026-10-19T10:00:00Z', 60), '2026-10-19T11:00:00.000Z')
  })

  it('returns the start for zero minutes', () => {
    assert.equal(add(schedule(), '2026-10-24T10:00:00Z', 0), '2026-10-24T10:00:00.000Z')
  })

  it('accepts a holiday date given as a full timestamp', () => {
    const s = schedule({ holidays: [{ date: '2026-10-20T00:00:00.000000Z', recurring: false }] })
    assert.equal(add(s, '2026-10-19T16:00:00Z', 120), '2026-10-21T10:00:00.000Z')
  })

  it('tells whether an instant is inside business hours', () => {
    const s = schedule({
      timezone: 'America/Toronto',
      holidays: [{ date: '2026-10-20', recurring: false }],
    })
    assert.equal(isWithinBusinessHours(at('2026-10-19T14:00:00Z'), s), true) // Mon 10:00
    assert.equal(isWithinBusinessHours(at('2026-10-19T12:59:00Z'), s), false) // Mon 08:59
    assert.equal(isWithinBusinessHours(at('2026-10-19T21:00:00Z'), s), false) // Mon 17:00
    assert.equal(isWithinBusinessHours(at('2026-10-20T14:00:00Z'), s), false) // holiday
    assert.equal(isWithinBusinessHours(at('2026-10-24T14:00:00Z'), s), false) // Saturday
  })

  it('counts the early hours of an overnight window as open', () => {
    const s = schedule({ schedule: { monday: { start: '22:00', end: '06:00' } } })
    assert.equal(isWithinBusinessHours(at('2026-10-20T03:00:00Z'), s), true) // Tue 03:00
    assert.equal(isWithinBusinessHours(at('2026-10-20T07:00:00Z'), s), false)
  })
})
