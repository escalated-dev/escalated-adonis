import { test } from '@japa/runner'
import { testApp } from './helpers/app.js'
import { getConfig } from '../../src/helpers/config.js'
import Migration from '../../database/migrations/0067_create_escalated_business_schedules.js'

/*
| Runs 0067 on ESCALATED_TEST_DATABASE_URL (MySQL or Postgres in CI, SQLite
| otherwise) and round-trips a schedule and its holidays through the models:
| pg and mysql2 read a DATE column back as a Date at local midnight, which
| the Holiday model has to turn back into the "YYYY-MM-DD" the pages show.
*/
test('business schedules migrate and round-trip on this database', async ({ assert }) => {
  const running = await testApp()
  const name = 'business_hours_migration'
  const url = process.env.ESCALATED_TEST_DATABASE_URL
  running.db.manager.add(
    name,
    url
      ? { client: url.startsWith('mysql') ? 'mysql2' : 'pg', connection: url }
      : {
          client: 'better-sqlite3',
          connection: { filename: ':memory:' },
          useNullAsDefault: true,
          pool: { min: 1, max: 1 },
        }
  )
  const connection = running.db.connection(name)
  const config = getConfig()
  const previous = config.connection
  try {
    for (const table of ['escalated_holidays', 'escalated_business_schedules']) {
      await connection.schema.dropTableIfExists(table)
    }
    await connection.schema.dropTableIfExists('escalated_sla_policies')
    await connection.schema.dropTableIfExists('escalated_departments')
    await connection.schema.createTable('escalated_sla_policies', (table: any) => {
      table.increments('id')
    })
    await connection.schema.createTable('escalated_departments', (table: any) => {
      table.increments('id')
    })

    await new Migration(connection, 'business-hours-up').execUp()
    assert.isTrue(
      await connection.schema.hasColumn('escalated_sla_policies', 'business_schedule_id')
    )
    assert.isTrue(
      await connection.schema.hasColumn('escalated_departments', 'business_schedule_id')
    )

    config.connection = name
    const { default: BusinessSchedule } = await import('../../src/models/business_schedule.js')
    const { default: Holiday } = await import('../../src/models/holiday.js')

    const schedule = await BusinessSchedule.create({
      name: 'Head office',
      timezone: 'America/Toronto',
      isDefault: true,
      schedule: { monday: { start: '09:00', end: '17:00' } },
    })
    await Holiday.create({
      scheduleId: schedule.id,
      name: 'Christmas',
      date: '2026-12-25',
      recurring: true,
    })

    const stored = await BusinessSchedule.query()
      .where('id', schedule.id)
      .preload('holidays')
      .firstOrFail()
    assert.isTrue(stored.isDefault)
    assert.deepEqual(stored.schedule, { monday: { start: '09:00', end: '17:00' } })
    assert.equal(stored.holidays[0].date, '2026-12-25')
    assert.isTrue(stored.holidays[0].recurring)
    assert.deepEqual(stored.toCalculatorSchedule().holidays, [
      { date: '2026-12-25', recurring: true },
    ])

    await new Migration(connection, 'business-hours-down').execDown()
    assert.isFalse(await connection.schema.hasTable('escalated_business_schedules'))
    assert.isFalse(
      await connection.schema.hasColumn('escalated_departments', 'business_schedule_id')
    )
  } finally {
    config.connection = previous
    for (const table of [
      'escalated_holidays',
      'escalated_business_schedules',
      'escalated_sla_policies',
      'escalated_departments',
    ]) {
      await connection.schema.dropTableIfExists(table)
    }
    await running.db.manager.close(name, true)
  }
}).timeout(60000)
