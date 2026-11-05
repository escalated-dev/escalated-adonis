import { test } from '@japa/runner'
import { testApp } from './helpers/app.js'
import Migration from '../../database/migrations/0075_create_escalated_agent_panel_data.js'

/*
|--------------------------------------------------------------------------
| Agent panel data tables on every advertised database
|--------------------------------------------------------------------------
|
| Runs 0075 up and down on its own connection: SQLite in memory by default,
| or the MySQL / PostgreSQL server in ESCALATED_TEST_DATABASE_URL (the CI
| database matrix), over a minimal escalated_tickets table. Existing tickets
| keep no customer activity, read markers are unique per agent and ticket and
| go with the ticket.
|
*/

test('agent panel data migration runs up and down', async ({ assert }) => {
  const running = await testApp()
  const name = 'agent_panel_data_migration'
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
  const tables = [
    'escalated_notifications',
    'escalated_customer_presence',
    'escalated_ticket_reads',
    'escalated_tickets',
  ]

  try {
    for (const table of tables) await connection.schema.dropTableIfExists(table)
    await connection.schema.createTable('escalated_tickets', (table) => {
      table.increments('id')
      table.string('subject')
    })
    await connection.table('escalated_tickets').insert({ subject: 'Before the upgrade' })

    await new Migration(connection, 'agent-panel-data-up').execUp()

    const ticket = await connection.from('escalated_tickets').first()
    assert.isNull(ticket.last_customer_activity_at)
    for (const table of tables) assert.isTrue(await connection.schema.hasTable(table), table)

    await connection.table('escalated_ticket_reads').insert({ user_id: 2, ticket_id: ticket.id })
    let duplicateRefused = false
    try {
      await connection.table('escalated_ticket_reads').insert({ user_id: 2, ticket_id: ticket.id })
    } catch {
      duplicateRefused = true
    }
    assert.isTrue(duplicateRefused, 'one read marker per agent and ticket')

    await connection.table('escalated_notifications').insert({
      id: '00000000-0000-4000-8000-000000000001',
      user_id: 2,
      type: 'ticket_assigned',
      data: JSON.stringify({ ticket_id: ticket.id }),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })

    await new Migration(connection, 'agent-panel-data-down').execDown()
    assert.isFalse(await connection.schema.hasTable('escalated_ticket_reads'))
    assert.isFalse(await connection.schema.hasTable('escalated_notifications'))
    assert.isFalse(
      await connection.schema.hasColumn('escalated_tickets', 'last_customer_activity_at')
    )
  } finally {
    for (const table of tables) await connection.schema.dropTableIfExists(table)
    await running.db.manager.close(name)
  }
})
