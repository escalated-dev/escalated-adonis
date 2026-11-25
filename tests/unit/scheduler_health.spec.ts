import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DateTime } from 'luxon'
import {
  describeScheduler,
  REQUIRED_SCHEDULED_COMMANDS,
  SCHEDULER_STALE_AFTER_MINUTES,
} from '../../src/support/scheduler_health.ts'

/**
 * The `scheduler` prop: healthy while the escalated:check-sla heartbeat is at
 * most 15 minutes old; otherwise a warning that names what to schedule.
 */

const NOW = DateTime.fromISO('2026-11-24T12:00:00Z')

describe('scheduler health', () => {
  it('is unhealthy when the SLA check has never run', () => {
    const status = describeScheduler(null, NOW)
    assert.equal(status.healthy, false)
    assert.equal(status.last_run_at, null)
    assert.match(status.message, /not running/)
    assert.match(status.message, /never run/)
    assert.deepEqual(
      status.commands.map((c) => c.command),
      [
        'node ace escalated:check-sla',
        'node ace escalated:wake-snoozed-tickets',
        'node ace escalated:run-escalations',
        'node ace escalated:run-automations',
      ]
    )
    for (const command of status.commands) assert.ok(command.interval)
  })

  it('is healthy within 15 minutes of the last run', () => {
    const lastRun = NOW.minus({ minutes: SCHEDULER_STALE_AFTER_MINUTES })
    const status = describeScheduler(lastRun, NOW)
    assert.equal(status.healthy, true)
    assert.equal(status.last_run_at, '2026-11-24T11:45:00.000Z')
    assert.deepEqual(status.commands, [...REQUIRED_SCHEDULED_COMMANDS])
  })

  it('is unhealthy when the last run is older than 15 minutes', () => {
    const status = describeScheduler(NOW.minus({ minutes: 16 }), NOW)
    assert.equal(status.healthy, false)
    assert.equal(status.last_run_at, '2026-11-24T11:44:00.000Z')
    assert.match(status.message, /not running/)
    assert.match(status.message, /11:44:00/)
  })

  it('treats an unreadable heartbeat as missing', () => {
    const status = describeScheduler(DateTime.fromISO('not a date'), NOW)
    assert.equal(status.healthy, false)
    assert.equal(status.last_run_at, null)
  })
})
