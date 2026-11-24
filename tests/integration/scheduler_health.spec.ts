import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { SCHEDULER_HEARTBEAT_SETTING } from '../../src/support/scheduler_health.js'

/*
|--------------------------------------------------------------------------
| Scheduler heartbeat and admin warning
|--------------------------------------------------------------------------
|
| `escalated:check-sla` records a heartbeat each run. Admin > Settings and the
| admin Reports pages send `scheduler` ({ healthy, last_run_at, message,
| commands }), unhealthy while the heartbeat is missing or more than 15
| minutes old, so the frontend can warn that the recurring jobs are not
| scheduled.
|
*/

test.group('Scheduler heartbeat', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(60_000)

  group.each.setup(async () => {
    await forget()
    // The migrations seed settings with JS Dates, which SQLite keeps as
    // numbers Lucid cannot read back (see sqlTimestamp); Admin > Settings
    // reads those rows.
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
  })

  group.teardown(async () => {
    await forget()
  })

  async function forget() {
    await running.db.from('escalated_settings').where('key', SCHEDULER_HEARTBEAT_SETTING).delete()
  }

  async function heartbeat(): Promise<string | null> {
    const row = await running.db
      .from('escalated_settings')
      .where('key', SCHEDULER_HEARTBEAT_SETTING)
      .first()
    return row?.value ?? null
  }

  async function page(path: string) {
    const response = await new InertiaClient(running.baseUrl, { user: TEST_USERS.admin }).visit(
      'GET',
      path,
      { inertia: false, headers: { Accept: 'application/json' } }
    )
    if (response.status !== 200) throw new Error(`${path}: ${JSON.stringify(response.body)}`)
    return response.body.props.scheduler
  }

  test('escalated:check-sla records the heartbeat', async ({ assert }) => {
    const ace = await running.app.container.make('ace')
    ace.ui.switchMode('raw')
    await ace.boot()

    const before = DateTime.now().minus({ seconds: 1 })
    const command = await ace.exec('escalated:check-sla', [])
    assert.equal(command.exitCode, 0)

    const stored = await heartbeat()
    assert.isNotNull(stored)
    assert.isTrue(DateTime.fromISO(stored!) >= before)

    const scheduler = await page('/support/admin/settings')
    assert.isTrue(scheduler.healthy)
    assert.equal(scheduler.last_run_at, DateTime.fromISO(stored!).toUTC().toISO())
  })

  test('Admin > Settings warns when the SLA check has never run', async ({ assert }) => {
    const scheduler = await page('/support/admin/settings')
    assert.isFalse(scheduler.healthy)
    assert.isNull(scheduler.last_run_at)
    assert.match(scheduler.message, /recurring jobs are not running/)
    assert.deepInclude(scheduler.commands, {
      command: 'node ace escalated:check-sla',
      interval: 'every minute',
    })
    assert.deepInclude(scheduler.commands, {
      command: 'node ace escalated:run-escalations',
      interval: 'every 5 minutes',
    })
  })

  test('the warning returns once the heartbeat is older than 15 minutes', async ({ assert }) => {
    const { recordSlaCheckHeartbeat } = await import('../../src/support/scheduler_health.js')

    await recordSlaCheckHeartbeat(DateTime.now().minus({ minutes: 10 }))
    assert.isTrue((await page('/support/admin/settings')).healthy)

    await recordSlaCheckHeartbeat(DateTime.now().minus({ minutes: 20 }))
    const stale = await page('/support/admin/settings')
    assert.isFalse(stale.healthy)
    assert.isNotNull(stale.last_run_at)
    assert.match(stale.message, /more than 15 minutes ago/)
  })

  test('the admin reports pages send the same prop', async ({ assert }) => {
    for (const path of ['/support/admin/reports', '/support/admin/reports/dashboard']) {
      const scheduler = await page(path)
      assert.isFalse(scheduler.healthy, path)
      assert.isArray(scheduler.commands, path)
    }
  })
})
