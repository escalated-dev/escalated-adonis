import { test } from '@japa/runner'
import { testApp } from './helpers/app.js'
import Migration from '../../database/migrations/0071_create_escalated_saml_message_ids.js'

/*
|--------------------------------------------------------------------------
| SAML message ID store on every advertised database
|--------------------------------------------------------------------------
|
| Runs 0071 up and down on its own connection: SQLite in memory by default,
| or the MySQL / PostgreSQL server in ESCALATED_TEST_DATABASE_URL (the CI
| database matrix). Replay protection relies on the unique key refusing a
| second row for the same kind and message ID, and on expires_at holding a
| Unix timestamp past 2038.
|
*/

test('SAML message ID migration runs up and down with its unique key', async ({ assert }) => {
  const running = await testApp()
  const name = 'saml_message_ids_migration'
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
    await new Migration(connection, 'saml-message-ids-up').execUp()
    assert.isTrue(await connection.schema.hasTable('escalated_saml_message_ids'))

    const longId = `_${'a'.repeat(190)}`
    const farFuture = 4_102_444_800 // 2100-01-01
    await connection
      .table('escalated_saml_message_ids')
      .insert({ kind: 'assertion', message_id: longId, expires_at: farFuture })
    // The same ID may be both an issued request and a used assertion.
    await connection
      .table('escalated_saml_message_ids')
      .insert({ kind: 'request', message_id: longId, expires_at: farFuture })

    let duplicateRefused = false
    try {
      await connection
        .table('escalated_saml_message_ids')
        .insert({ kind: 'assertion', message_id: longId, expires_at: farFuture })
    } catch {
      duplicateRefused = true
    }
    assert.isTrue(duplicateRefused, 'a second row for the same kind and message ID is refused')

    const row = await connection
      .from('escalated_saml_message_ids')
      .where('kind', 'assertion')
      .where('message_id', longId)
      .first()
    assert.equal(Number(row.expires_at), farFuture)

    await new Migration(connection, 'saml-message-ids-down').execDown()
    assert.isFalse(await connection.schema.hasTable('escalated_saml_message_ids'))
  } finally {
    if (await connection.schema.hasTable('escalated_saml_message_ids')) {
      await connection.schema.dropTable('escalated_saml_message_ids')
    }
    await running.db.manager.close(name, true)
  }
})
