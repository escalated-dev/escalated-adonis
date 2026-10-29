import { test } from '@japa/runner'
import { testApp } from './helpers/app.js'
import CreateTwoFactor from '../../database/migrations/0061_create_escalated_two_factor.js'
import AddLastUsedStep from '../../database/migrations/0073_add_last_used_step_to_escalated_two_factor.js'

/*
|--------------------------------------------------------------------------
| Two-factor replay column on every advertised database
|--------------------------------------------------------------------------
|
| Runs 0073 up and down on its own connection: SQLite in memory by default,
| or the MySQL / PostgreSQL server in ESCALATED_TEST_DATABASE_URL (the CI
| database matrix). `last_used_step` holds a TOTP time step (Unix time / 30),
| which must survive as a whole number and start out null for existing rows.
|
*/

test('two-factor last_used_step migration runs up and down', async ({ assert }) => {
  const running = await testApp()
  const name = 'two_factor_step_migration'
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
  const now = new Date()

  try {
    if (await connection.schema.hasTable('escalated_two_factor')) {
      await connection.schema.dropTable('escalated_two_factor')
    }
    await new CreateTwoFactor(connection, 'two-factor-create').execUp()
    await connection.table('escalated_two_factor').insert({
      user_id: 7,
      secret: 'encrypted',
      created_at: now,
      updated_at: now,
    })

    await new AddLastUsedStep(connection, 'two-factor-step-up').execUp()
    const existing = await connection.from('escalated_two_factor').where('user_id', 7).first()
    assert.isNull(existing.last_used_step)

    const step = Math.floor(4_102_444_800 / 30) // 2100-01-01
    await connection
      .from('escalated_two_factor')
      .where('user_id', 7)
      .update({ last_used_step: step })
    const row = await connection.from('escalated_two_factor').where('user_id', 7).first()
    assert.equal(Number(row.last_used_step), step)

    await new AddLastUsedStep(connection, 'two-factor-step-down').execDown()
    assert.isFalse(await connection.schema.hasColumn('escalated_two_factor', 'last_used_step'))
  } finally {
    if (await connection.schema.hasTable('escalated_two_factor')) {
      await connection.schema.dropTable('escalated_two_factor')
    }
    await running.db.manager.close(name, true)
  }
})
