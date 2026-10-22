import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Custom fields and custom objects admin pages
|--------------------------------------------------------------------------
|
| The shared frontend ships Admin/CustomFields/{Index,Form} and
| Admin/CustomObjects/{Index,Form,Records}. Neither feature existed here.
|
| Routes, names, props and redirects follow escalated-laravel's
| Admin\CustomFieldController and Admin\CustomObjectController.
|
*/

const FIELDS = '/support/admin/custom-fields'
const OBJECTS = '/support/admin/custom-objects'

test.group('Custom field admin pages', (group) => {
  let running: TestApp
  let client: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_custom_field_values').delete()
    await running.db.from('escalated_custom_fields').delete()
  })

  group.each.timeout(30_000)

  async function storeField(data: Record<string, unknown>) {
    return client.visit('POST', FIELDS, {
      data: { type: 'text', context: 'ticket', ...data },
      referer: `${FIELDS}/create`,
    })
  }

  test('index renders CustomFields/Index with every field ordered by position', async ({
    assert,
  }) => {
    await storeField({ name: 'Second', position: 2 })
    await storeField({ name: 'First', position: 1, required: true })

    const visit = await client.visit('GET', FIELDS)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/CustomFields/Index')
    const fields = visit.body.props.fields
    assert.deepEqual(
      fields.map((f: any) => f.name),
      ['First', 'Second']
    )
    const [first] = fields
    for (const key of [
      'id',
      'name',
      'slug',
      'type',
      'context',
      'options',
      'required',
      'placeholder',
      'description',
      'validation_rules',
      'conditions',
      'position',
      'active',
      'created_at',
      'updated_at',
    ]) {
      assert.property(first, key)
    }
    assert.equal(first.slug, 'first')
    assert.equal(first.type, 'text')
    assert.equal(first.context, 'ticket')
    assert.strictEqual(first.required, true)
    assert.strictEqual(first.active, true)
    assert.strictEqual(first.position, 1)
  })

  test('create renders CustomFields/Form with the contexts', async ({ assert }) => {
    const visit = await client.visit('GET', `${FIELDS}/create`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/CustomFields/Form')
    assert.deepEqual(visit.body.props.contexts, ['ticket', 'user', 'organization'])
    assert.notExists(visit.body.props.field)
  })

  test('store creates the field and redirects to the index with a flash', async ({ assert }) => {
    const visit = await storeField({
      name: 'Order Number',
      required: true,
      placeholder: 'e.g. 1234',
      description: 'From the receipt',
      position: 3,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, FIELDS)
    const row = await running.db.from('escalated_custom_fields').first()
    assert.equal(row.name, 'Order Number')
    assert.equal(row.slug, 'order_number')
    assert.isTrue(Boolean(row.required))
    assert.isTrue(Boolean(row.active))

    const index = await client.visit('GET', FIELDS)
    assert.equal(index.body.flash.success, 'Custom field created.')
  })

  test('slugs are de-duplicated with a numeric suffix', async ({ assert }) => {
    await storeField({ name: 'Region' })
    await storeField({ name: 'Region' })
    await storeField({ name: 'Region' })

    const rows = await running.db.from('escalated_custom_fields').orderBy('id')
    assert.deepEqual(
      rows.map((r: any) => r.slug),
      ['region', 'region_2', 'region_3']
    )
  })

  test('select and multi_select need at least one option', async ({ assert }) => {
    const visit = await storeField({ name: 'Plan', type: 'select', options: [] })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${FIELDS}/create`)
    assert.lengthOf(await running.db.from('escalated_custom_fields'), 0)

    const back = await client.visit('GET', `${FIELDS}/create`)
    assert.include(Object.keys(back.body.flash.errors ?? {}), 'options')

    const ok = await storeField({ name: 'Plan', type: 'multi_select', options: ['a', 'b'] })
    assert.equal(ok.status, 302)
    const row = await running.db.from('escalated_custom_fields').first()
    const options = typeof row.options === 'string' ? JSON.parse(row.options) : row.options
    assert.deepEqual(options, ['a', 'b'])
  })

  test('an unknown type or a missing name is refused', async ({ assert }) => {
    const visit = await storeField({ name: '', type: 'colour' })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${FIELDS}/create`)
    const back = await client.visit('GET', `${FIELDS}/create`)
    assert.include(Object.keys(back.body.flash.errors ?? {}), 'name')
    assert.include(Object.keys(back.body.flash.errors ?? {}), 'type')
    assert.lengthOf(await running.db.from('escalated_custom_fields'), 0)
  })

  test('edit renders CustomFields/Form with the field and contexts', async ({ assert }) => {
    await storeField({ name: 'Plan', type: 'select', options: ['basic', 'pro'] })
    const row = await running.db.from('escalated_custom_fields').first()

    const visit = await client.visit('GET', `${FIELDS}/${row.id}/edit`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/CustomFields/Form')
    const field = visit.body.props.field
    assert.equal(field.id, row.id)
    assert.equal(field.name, 'Plan')
    assert.equal(field.type, 'select')
    assert.deepEqual(field.options, ['basic', 'pro'])
    for (const key of ['context', 'required', 'placeholder', 'description', 'position', 'active']) {
      assert.property(field, key)
    }
    assert.deepEqual(visit.body.props.contexts, ['ticket', 'user', 'organization'])
  })

  test('edit of a missing field is a 404', async ({ assert }) => {
    const visit = await client.visit('GET', `${FIELDS}/999999/edit`)
    assert.equal(visit.status, 404)
  })

  test('update saves the form and keeps the slug', async ({ assert }) => {
    await storeField({ name: 'Plan' })
    const row = await running.db.from('escalated_custom_fields').first()

    const visit = await client.visit('PUT', `${FIELDS}/${row.id}`, {
      data: {
        name: 'Plan name',
        type: 'textarea',
        context: 'user',
        options: [],
        required: false,
        placeholder: '',
        description: 'Changed',
        position: 5,
        active: false,
      },
      referer: `${FIELDS}/${row.id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, FIELDS)
    const updated = await running.db.from('escalated_custom_fields').where('id', row.id).first()
    assert.equal(updated.name, 'Plan name')
    assert.equal(updated.slug, 'plan')
    assert.equal(updated.type, 'textarea')
    assert.equal(updated.context, 'user')
    assert.equal(updated.position, 5)
    assert.isFalse(Boolean(updated.active))

    const index = await client.visit('GET', FIELDS)
    assert.equal(index.body.flash.success, 'Custom field updated.')
  })

  test('destroy deletes the field and its values', async ({ assert }) => {
    await storeField({ name: 'Plan' })
    const row = await running.db.from('escalated_custom_fields').first()
    await running.db.table('escalated_custom_field_values').insert({
      custom_field_id: row.id,
      entity_type: 'ticket',
      entity_id: '1',
      value: 'x',
      created_at: new Date(),
      updated_at: new Date(),
    })

    const visit = await client.visit('DELETE', `${FIELDS}/${row.id}`, { referer: FIELDS })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, FIELDS)
    assert.lengthOf(await running.db.from('escalated_custom_fields'), 0)
    assert.lengthOf(await running.db.from('escalated_custom_field_values'), 0)
    const index = await client.visit('GET', FIELDS)
    assert.equal(index.body.flash.success, 'Custom field deleted.')
  })

  test('reorder sets positions and goes back', async ({ assert }) => {
    await storeField({ name: 'A', position: 0 })
    await storeField({ name: 'B', position: 1 })
    const [a, b] = await running.db.from('escalated_custom_fields').orderBy('id')

    const visit = await client.visit('POST', `${FIELDS}/reorder`, {
      data: {
        positions: [
          { id: a.id, position: 1 },
          { id: b.id, position: 0 },
        ],
      },
      referer: FIELDS,
    })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, FIELDS)
    const index = await client.visit('GET', FIELDS)
    assert.deepEqual(
      index.body.props.fields.map((f: any) => f.name),
      ['B', 'A']
    )
  })

  test('agents cannot reach the admin pages', async ({ assert }) => {
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    const visit = await agent.visit('GET', FIELDS)
    assert.notEqual(visit.status, 200)
  })
})

test.group('Custom object admin pages', (group) => {
  let running: TestApp
  let client: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_custom_object_records').delete()
    await running.db.from('escalated_custom_objects').delete()
  })

  group.each.timeout(30_000)

  const SCHEMA = [
    { name: 'Name', type: 'text', required: true },
    { name: 'Seats', type: 'number' },
    { name: 'Plan', type: 'select', options: ['basic', 'pro'] },
    { name: 'Renews', type: 'date' },
  ]

  async function storeObject(data: Record<string, unknown> = {}) {
    return client.visit('POST', OBJECTS, {
      data: { name: 'Contracts', slug: 'contracts', fields_schema: SCHEMA, ...data },
      referer: `${OBJECTS}/create`,
    })
  }

  async function object() {
    return running.db.from('escalated_custom_objects').orderBy('id', 'desc').first()
  }

  test('index renders CustomObjects/Index ordered by name with records_count', async ({
    assert,
  }) => {
    await storeObject({ name: 'Zeta', slug: 'zeta' })
    await storeObject({ name: 'Alpha', slug: 'alpha' })
    const alpha = await running.db.from('escalated_custom_objects').where('slug', 'alpha').first()
    await client.visit('POST', `${OBJECTS}/${alpha.id}/records`, {
      data: { data: { Name: 'Acme' } },
      referer: `${OBJECTS}/${alpha.id}/records`,
    })

    const visit = await client.visit('GET', OBJECTS)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/CustomObjects/Index')
    const objects = visit.body.props.objects
    assert.deepEqual(
      objects.map((o: any) => o.name),
      ['Alpha', 'Zeta']
    )
    const [first] = objects
    for (const key of [
      'id',
      'name',
      'slug',
      'fields_schema',
      'records_count',
      'created_at',
      'updated_at',
    ]) {
      assert.property(first, key)
    }
    assert.equal(first.slug, 'alpha')
    assert.lengthOf(first.fields_schema, 4)
    assert.strictEqual(first.records_count, 1)
    assert.strictEqual(objects[1].records_count, 0)
  })

  test('create renders CustomObjects/Form with no object', async ({ assert }) => {
    const visit = await client.visit('GET', `${OBJECTS}/create`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/CustomObjects/Form')
    assert.notExists(visit.body.props.object)
  })

  test('store creates the object and redirects to the index', async ({ assert }) => {
    const visit = await storeObject()

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, OBJECTS)
    const row = await object()
    assert.equal(row.slug, 'contracts')
    const index = await client.visit('GET', OBJECTS)
    assert.equal(index.body.flash.success, 'Custom object created.')
  })

  test('store refuses a taken slug, a bad slug, and an empty schema', async ({ assert }) => {
    await storeObject()

    for (const data of [
      { slug: 'contracts' },
      { slug: 'not a slug!' },
      { slug: 'other', fields_schema: [] },
      { slug: 'other', fields_schema: [{ name: '', type: 'text' }] },
      { slug: 'other', fields_schema: [{ name: 'X', type: 'colour' }] },
    ]) {
      const visit = await storeObject(data)
      assert.equal(visit.status, 302)
      assert.equal(visit.location, `${OBJECTS}/create`, JSON.stringify(data))
    }
    assert.lengthOf(await running.db.from('escalated_custom_objects'), 1)
  })

  test('edit renders CustomObjects/Form with the object', async ({ assert }) => {
    await storeObject()
    const row = await object()

    const visit = await client.visit('GET', `${OBJECTS}/${row.id}/edit`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/CustomObjects/Form')
    const props = visit.body.props.object
    assert.equal(props.id, row.id)
    assert.equal(props.name, 'Contracts')
    assert.equal(props.slug, 'contracts')
    assert.deepEqual(props.fields_schema, SCHEMA)
  })

  test('update saves and may keep its own slug', async ({ assert }) => {
    await storeObject()
    const row = await object()

    const visit = await client.visit('PUT', `${OBJECTS}/${row.id}`, {
      data: { name: 'Deals', slug: 'contracts', fields_schema: [{ name: 'Name', type: 'text' }] },
      referer: `${OBJECTS}/${row.id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, OBJECTS)
    const updated = await object()
    assert.equal(updated.name, 'Deals')
    const index = await client.visit('GET', OBJECTS)
    assert.equal(index.body.flash.success, 'Custom object updated.')
  })

  test('destroy deletes the object and its records', async ({ assert }) => {
    await storeObject()
    const row = await object()
    await client.visit('POST', `${OBJECTS}/${row.id}/records`, {
      data: { data: { Name: 'Acme' } },
      referer: `${OBJECTS}/${row.id}/records`,
    })

    const visit = await client.visit('DELETE', `${OBJECTS}/${row.id}`, { referer: OBJECTS })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, OBJECTS)
    assert.lengthOf(await running.db.from('escalated_custom_objects'), 0)
    assert.lengthOf(await running.db.from('escalated_custom_object_records'), 0)
  })

  test('records renders CustomObjects/Records newest first', async ({ assert }) => {
    await storeObject()
    const row = await object()
    for (const name of ['Older', 'Newer']) {
      await client.visit('POST', `${OBJECTS}/${row.id}/records`, {
        data: { data: { Name: name, Seats: '5', Plan: 'pro', Renews: '2026-12-01' } },
        referer: `${OBJECTS}/${row.id}/records`,
      })
    }

    const visit = await client.visit('GET', `${OBJECTS}/${row.id}/records`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/CustomObjects/Records')
    const props = visit.body.props
    assert.equal(props.object.id, row.id)
    assert.equal(props.object.name, 'Contracts')
    assert.lengthOf(props.object.fields_schema, 4)
    assert.lengthOf(props.records, 2)
    const [newest] = props.records
    for (const key of ['id', 'object_id', 'data', 'created_at', 'updated_at']) {
      assert.property(newest, key)
    }
    assert.equal(newest.data.Name, 'Newer')
    assert.equal(newest.object_id, row.id)
  })

  test('record store, update and destroy go back with a flash', async ({ assert }) => {
    await storeObject()
    const row = await object()
    const page = `${OBJECTS}/${row.id}/records`

    const stored = await client.visit('POST', page, {
      data: { data: { Name: 'Acme' } },
      referer: page,
    })
    assert.equal(stored.status, 302)
    assert.equal(stored.location, page)
    const record = await running.db.from('escalated_custom_object_records').first()

    const updated = await client.visit('PUT', `${page}/${record.id}`, {
      data: { data: { Name: 'Acme Corp', Seats: 10 } },
      referer: page,
    })
    assert.equal(updated.status, 302)
    assert.equal(updated.location, page)
    const after = await running.db.from('escalated_custom_object_records').first()
    const data = typeof after.data === 'string' ? JSON.parse(after.data) : after.data
    assert.equal(data.Name, 'Acme Corp')

    const index = await client.visit('GET', page)
    assert.equal(index.body.flash.success, 'Record updated.')

    const destroyed = await client.visit('DELETE', `${page}/${record.id}`, { referer: page })
    assert.equal(destroyed.status, 302)
    assert.lengthOf(await running.db.from('escalated_custom_object_records'), 0)
  })

  test('record data is validated against the schema', async ({ assert }) => {
    await storeObject()
    const row = await object()
    const page = `${OBJECTS}/${row.id}/records`

    const cases: Array<[Record<string, unknown> | unknown, string]> = [
      [{ Seats: 3 }, 'data.Name'],
      [{ Name: '' }, 'data.Name'],
      [{ Name: 'A', Seats: 'many' }, 'data.Seats'],
      [{ Name: 'A', Renews: '2026-02-31' }, 'data.Renews'],
      [{ Name: 'A', Plan: 'gold' }, 'data.Plan'],
      [{ Name: 'A', Colour: 'red' }, 'data.Colour'],
      ['not an object', 'data'],
    ]
    for (const [data, key] of cases) {
      const visit = await client.visit('POST', page, { data: { data }, referer: page })
      assert.equal(visit.status, 302)
      const back = await client.visit('GET', page)
      assert.include(Object.keys(back.body.flash.errors ?? {}), key, JSON.stringify(data))
    }
    assert.lengthOf(await running.db.from('escalated_custom_object_records'), 0)

    // Empty optional values, as the shared form sends them, are fine.
    const ok = await client.visit('POST', page, {
      data: { data: { Name: 'A', Seats: '', Plan: '', Renews: '' } },
      referer: page,
    })
    assert.equal(ok.status, 302)
    assert.lengthOf(await running.db.from('escalated_custom_object_records'), 1)
  })

  test('a record of another object is a 404', async ({ assert }) => {
    await storeObject()
    const first = await object()
    await storeObject({ name: 'Other', slug: 'other' })
    const second = await object()
    await client.visit('POST', `${OBJECTS}/${first.id}/records`, {
      data: { data: { Name: 'Acme' } },
      referer: `${OBJECTS}/${first.id}/records`,
    })
    const record = await running.db.from('escalated_custom_object_records').first()

    const update = await client.visit('PUT', `${OBJECTS}/${second.id}/records/${record.id}`, {
      data: { data: { Name: 'Hijack' } },
    })
    assert.equal(update.status, 404)
    const destroy = await client.visit('DELETE', `${OBJECTS}/${second.id}/records/${record.id}`)
    assert.equal(destroy.status, 404)
    assert.lengthOf(await running.db.from('escalated_custom_object_records'), 1)
  })
})
