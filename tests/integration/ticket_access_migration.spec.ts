import { test } from '@japa/runner'
import { testApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'
import { withTicketAccess } from '../../src/support/ticket_access.js'
import Migration from '../../database/migrations/0064_ticket_access_and_routing.js'

test('account migration preserves old tickets and scopes the separate package connection', async ({
  assert,
}) => {
  const running = await testApp()
  const name = 'ticket_access_migration'
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
  const previous = {
    connection: config.connection,
    visibility: config.visibility,
    accounts: config.accounts,
  }
  try {
    await connection.schema.createTable('escalated_departments', (table: any) => {
      table.increments('id')
    })
    await connection.schema.createTable('escalated_tickets', (table: any) => {
      table.increments('id')
      table.integer('department_id').unsigned().nullable()
    })
    await connection.schema.createTable('escalated_sla_policies', (table: any) => {
      table.increments('id')
    })
    await connection.schema.createTable('escalated_department_agent', (table: any) => {
      table.integer('department_id').unsigned()
      table.integer('agent_id')
    })
    await connection.table('escalated_tickets').insert([
      { id: 1, department_id: 1 },
      { id: 2, department_id: 2 },
      { id: 3, department_id: null },
    ])
    await connection
      .table('escalated_department_agent')
      .insert({ department_id: 1, agent_id: TEST_USERS.agent.id })
    await new Migration(connection, 'ticket-access-up').execUp()
    const original = await connection.from('escalated_tickets').where('id', 1).first()
    assert.isNull(original.account_id)
    await connection
      .from('escalated_tickets')
      .whereIn('id', [1, 2])
      .update({ account_type: 'Company', account_id: 'ABC' })
    config.connection = name
    config.visibility = 'department'
    config.accounts = {
      enabled: true,
      scopeAgents: true,
      resolver: () => ({ type: 'Company', id: 'ABC' }),
    }
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const result = await withTicketAccess(TEST_USERS.agent, () => Ticket.query().orderBy('id'))
    assert.deepEqual(
      result.map((row) => row.id),
      [1]
    )
    config.accounts.resolver = () => ({ type: 'Company', id: 'abc' })
    const mismatch = await withTicketAccess(TEST_USERS.agent, () => Ticket.query())
    assert.isEmpty(mismatch)
    await new Migration(connection, 'ticket-access-down').execDown()
    assert.isFalse(await connection.schema.hasColumn('escalated_tickets', 'account_id'))
    const restored = await connection.from('escalated_tickets').orderBy('id')
    assert.deepEqual(
      restored.map((row: any) => row.id),
      [1, 2, 3]
    )
  } finally {
    Object.assign(config, previous)
    for (const table of [
      'escalated_sla_policies',
      'escalated_tickets',
      'escalated_department_agent',
      'escalated_departments',
    ]) {
      await connection.schema.dropTableIfExists(table)
    }
    await running.db.manager.close(name, true)
  }
}).timeout(60000)
