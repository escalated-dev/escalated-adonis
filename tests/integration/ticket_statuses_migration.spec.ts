import { test } from '@japa/runner'
import { sqlTimestamp, testApp } from './helpers/app.js'
import Migration from '../../database/migrations/0067_create_escalated_ticket_statuses.js'

/*
|--------------------------------------------------------------------------
| Custom statuses migration
|--------------------------------------------------------------------------
|
| Runs on SQLite here, and on MySQL and Postgres in CI through
| ESCALATED_TEST_DATABASE_URL. Existing tickets keep their status and get a
| NULL custom status; the built-ins are seeded as system rows; deleting a
| custom status sets the tickets' reference to NULL; down() undoes it all.
|
*/

test('the custom statuses migration keeps existing tickets valid and seeds the built-ins', async ({
  assert,
}) => {
  const running = await testApp()
  const name = 'ticket_statuses_migration'
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

  try {
    await connection.schema.createTable('escalated_tickets', (table: any) => {
      table.increments('id')
      table.string('status', 32).notNullable().defaultTo('open')
    })
    await connection.table('escalated_tickets').multiInsert([
      { id: 1, status: 'open' },
      { id: 2, status: 'resolved' },
    ])

    await new Migration(connection, 'ticket-statuses-up').execUp()

    const tickets = await connection.from('escalated_tickets').orderBy('id')
    assert.deepEqual(
      tickets.map((t: any) => [t.status, t.ticket_status_id]),
      [
        ['open', null],
        ['resolved', null],
      ]
    )

    const system = await connection
      .from('escalated_ticket_statuses')
      .where('is_system', true)
      .orderBy('id')
    assert.deepEqual(Object.fromEntries(system.map((s: any) => [s.slug, s.category])), {
      open: 'open',
      in_progress: 'open',
      waiting_on_customer: 'pending',
      waiting_on_agent: 'open',
      escalated: 'open',
      resolved: 'solved',
      closed: 'solved',
      reopened: 'open',
    })
    assert.equal(system.find((s: any) => s.slug === 'resolved').label, 'Resolved')

    const now = sqlTimestamp()
    await connection.table('escalated_ticket_statuses').insert({
      label: 'Awaiting parts',
      slug: 'awaiting_parts',
      category: 'on_hold',
      color: '#6b7280',
      position: 0,
      is_default: false,
      is_system: false,
      created_at: now,
      updated_at: now,
    })
    const custom = await connection
      .from('escalated_ticket_statuses')
      .where('slug', 'awaiting_parts')
      .first()
    assert.equal(custom.color, '#6b7280')

    // The slug is unique.
    let duplicate: unknown = null
    try {
      await connection.table('escalated_ticket_statuses').insert({
        label: 'Again',
        slug: 'awaiting_parts',
        category: 'open',
        color: '#000000',
      })
    } catch (error) {
      duplicate = error
    }
    assert.exists(duplicate, 'a second row with the same slug was accepted')

    await connection
      .from('escalated_tickets')
      .where('id', 1)
      .update({ status: 'in_progress', ticket_status_id: custom.id })

    if (url) {
      // ON DELETE SET NULL. SQLite only enforces foreign keys when asked to,
      // so there the controller nulls the column itself (tested over HTTP).
      await connection.from('escalated_ticket_statuses').where('id', custom.id).delete()
      const row = await connection.from('escalated_tickets').where('id', 1).first()
      assert.isNull(row.ticket_status_id)
      assert.equal(row.status, 'in_progress')
    }

    await new Migration(connection, 'ticket-statuses-down').execDown()
    assert.isFalse(await connection.schema.hasColumn('escalated_tickets', 'ticket_status_id'))
    assert.isFalse(await connection.schema.hasTable('escalated_ticket_statuses'))
    assert.lengthOf(await connection.from('escalated_tickets'), 2)
  } finally {
    await connection.schema.dropTableIfExists('escalated_tickets')
    await connection.schema.dropTableIfExists('escalated_ticket_statuses')
    await running.db.manager.close(name, true)
  }
}).timeout(60000)
