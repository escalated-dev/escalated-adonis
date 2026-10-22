import { test } from '@japa/runner'
import { testApp } from './helpers/app.js'
import Migration from '../../database/migrations/0069_create_escalated_custom_fields.js'

/*
|--------------------------------------------------------------------------
| Custom fields migration on every advertised database
|--------------------------------------------------------------------------
|
| Runs 0069 up and down on its own connection: SQLite in memory by default,
| or the MySQL / PostgreSQL server in ESCALATED_TEST_DATABASE_URL (the CI
| database matrix). Checks the unique keys and the cascades the feature
| relies on.
|
*/

test('custom fields migration runs up and down with unique keys and cascades', async ({
  assert,
}) => {
  const running = await testApp()
  const name = 'custom_fields_migration'
  const url = process.env.ESCALATED_TEST_DATABASE_URL
  running.db.manager.add(
    name,
    url
      ? { client: url.startsWith('mysql') ? 'mysql2' : 'pg', connection: url }
      : {
          client: 'better-sqlite3',
          connection: { filename: ':memory:' },
          useNullAsDefault: true,
          pool: {
            min: 1,
            max: 1,
            afterCreate: (conn: any, done: any) => {
              conn.pragma('foreign_keys = ON')
              done()
            },
          },
        }
  )
  const connection = running.db.connection(name)
  const now = new Date()
  const stamps = { created_at: now, updated_at: now }

  try {
    await new Migration(connection, 'custom-fields-up').execUp()

    for (const table of [
      'escalated_custom_fields',
      'escalated_custom_field_values',
      'escalated_custom_objects',
      'escalated_custom_object_records',
    ]) {
      assert.isTrue(await connection.schema.hasTable(table), table)
    }

    const [fieldId] = await connection
      .table('escalated_custom_fields')
      .insert({ name: 'Plan', slug: 'plan', type: 'select', options: '["a"]', ...stamps })
      .returning('id')
    const fid = typeof fieldId === 'object' ? fieldId.id : fieldId
    const field = await connection.from('escalated_custom_fields').where('id', fid).first()
    assert.equal(field.context, 'ticket')
    assert.isFalse(Boolean(field.required))
    assert.isTrue(Boolean(field.active))
    assert.equal(field.position, 0)

    await assert.rejects(() =>
      connection
        .table('escalated_custom_fields')
        .insert({ name: 'Plan', slug: 'plan', type: 'text', ...stamps })
    )

    await connection.table('escalated_custom_field_values').insert({
      custom_field_id: fid,
      entity_type: 'ticket',
      entity_id: '1',
      value: 'a',
      ...stamps,
    })
    await assert.rejects(() =>
      connection.table('escalated_custom_field_values').insert({
        custom_field_id: fid,
        entity_type: 'ticket',
        entity_id: '1',
        value: 'b',
        ...stamps,
      })
    )

    const [objectId] = await connection
      .table('escalated_custom_objects')
      .insert({ name: 'Deals', slug: 'deals', fields_schema: '[]', ...stamps })
      .returning('id')
    const oid = typeof objectId === 'object' ? objectId.id : objectId
    await connection
      .table('escalated_custom_object_records')
      .insert({ object_id: oid, data: '{}', ...stamps })

    await connection.from('escalated_custom_fields').where('id', fid).delete()
    await connection.from('escalated_custom_objects').where('id', oid).delete()
    assert.lengthOf(await connection.from('escalated_custom_field_values'), 0)
    assert.lengthOf(await connection.from('escalated_custom_object_records'), 0)

    await new Migration(connection, 'custom-fields-down').execDown()
    assert.isFalse(await connection.schema.hasTable('escalated_custom_fields'))
    assert.isFalse(await connection.schema.hasTable('escalated_custom_object_records'))
  } finally {
    for (const table of [
      'escalated_custom_object_records',
      'escalated_custom_objects',
      'escalated_custom_field_values',
      'escalated_custom_fields',
    ]) {
      await connection.schema.dropTableIfExists(table)
    }
    await running.db.manager.close(name, true)
  }
}).timeout(60000)
