import { test } from '@japa/runner'
import { testApp } from './helpers/app.js'

/*
|--------------------------------------------------------------------------
| Migrations from scratch
|--------------------------------------------------------------------------
|
| `0048_create_escalated_agent_skills.ts` called `table.smallInteger()`, which
| knex does not have, so `node ace migration:run` on a new database stopped
| there and every migration after it (0049-0063) never ran. Nothing caught it:
| the tsconfig does not include `database/`, and no test ran the migrations.
|
| This runs them the way `migration:run` does, through Lucid's MigrationRunner,
| on a fresh in-memory SQLite connection of its own.
|
*/

const CONNECTION = 'fresh_migrations'

test.group('Migrations from scratch', (group) => {
  group.each.timeout(60_000)

  test('run to the last migration on an empty database', async ({ assert, cleanup }) => {
    const running = await testApp()
    const { MigrationRunner } = await import('@adonisjs/lucid/migration')

    if (!running.db.manager.has(CONNECTION)) {
      running.db.manager.add(CONNECTION, {
        client: 'better-sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
        // A single connection: each new one would open its own empty database.
        pool: { min: 1, max: 1 },
      })
    }

    const migrator = new MigrationRunner(running.db, running.app, {
      direction: 'up',
      connectionName: CONNECTION,
    })

    // Close only this connection. MigrationRunner.close() closes and releases
    // every connection, which would take the shared application's database
    // down with it for the specs that run after this one.
    cleanup(async () => {
      if (running.db.manager.has(CONNECTION)) {
        await running.db.manager.close(CONNECTION, true)
      }
    })

    await migrator.run()

    assert.isNull(migrator.error, migrator.error?.message)
    assert.equal(migrator.status, 'completed')

    const client = running.db.connection(CONNECTION)

    // The last migration's table.
    assert.isTrue(await client.schema.hasTable('escalated_audit_logs'))

    // 0048's own table, with proficiency still required and defaulting to 3.
    assert.isTrue(await client.schema.hasTable('escalated_agent_skills'))
    const columns = await client.columnsInfo('escalated_agent_skills')
    assert.isFalse(columns.proficiency.nullable)
    assert.equal(String(columns.proficiency.defaultValue).replace(/'/g, ''), '3')
  })
})
