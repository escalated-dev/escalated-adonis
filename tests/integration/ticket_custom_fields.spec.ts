import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS, type TestUser } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Ticket custom field values
|--------------------------------------------------------------------------
|
| Ticket create and update endpoints accept an optional `custom_fields` object
| keyed by field slug. Only active ticket-context fields count; values are
| validated before the ticket is written. Create pages get the definitions as
| `custom_fields`; show pages and the API detail get them with `value`.
|
| This is the shared contract in CUSTOM-FIELDS-SPEC.md, the same in every port.
|
*/

test.group('Ticket custom field values', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  // One client per user per test, so a flash written by one request is read
  // by the next through the same session cookie.
  let clients: Record<string, InertiaClient> = {}
  const client = (user: TestUser) =>
    (clients[user.id] ??= new InertiaClient(running.baseUrl, { user }))
  const customer = () => client(TEST_USERS.customer)
  const agent = () => client(TEST_USERS.agent)
  const admin = () => client(TEST_USERS.admin)

  group.each.setup(async () => {
    clients = {}
    await running.db.from('escalated_custom_field_values').delete()
    await running.db.from('escalated_custom_fields').delete()
  })

  group.each.timeout(30_000)

  async function field(data: Record<string, unknown>) {
    const { default: CustomField } = await import('../../src/models/custom_field.js')
    return CustomField.create({
      context: 'ticket',
      required: false,
      active: true,
      position: 0,
      ...data,
    } as any)
  }

  async function standardFields() {
    await field({ name: 'Order', slug: 'order', type: 'text', required: true, position: 1 })
    await field({ name: 'Seats', slug: 'seats', type: 'number', position: 2 })
    await field({ name: 'Due', slug: 'due', type: 'date', position: 3 })
    await field({
      name: 'Plan',
      slug: 'plan',
      type: 'select',
      options: ['basic', 'pro'],
      position: 4,
    })
    await field({
      name: 'Areas',
      slug: 'areas',
      type: 'multi_select',
      options: ['billing', 'login', 'api'],
      position: 5,
    })
    await field({ name: 'Urgent', slug: 'urgent', type: 'checkbox', position: 6 })
    await field({ name: 'Notes', slug: 'notes', type: 'textarea', position: 7 })
    await field({ name: 'Old', slug: 'old', type: 'text', active: false, position: 8 })
    await field({ name: 'Company', slug: 'company', type: 'text', context: 'user', position: 9 })
  }

  async function ticketCount() {
    const [{ total }] = await running.db.from('escalated_tickets').count('* as total')
    return Number(total)
  }

  async function storedValues(ticketId: number) {
    const rows = await running.db
      .from('escalated_custom_field_values as v')
      .join('escalated_custom_fields as f', 'f.id', 'v.custom_field_id')
      .where('v.entity_type', 'ticket')
      .where('v.entity_id', String(ticketId))
      .select('f.slug', 'v.value')
    return Object.fromEntries(rows.map((r: any) => [r.slug, r.value]))
  }

  function createTicket(data: Record<string, unknown>) {
    return customer().visit('POST', '/support', {
      data: { subject: 'Custom fields', description: 'Body', priority: 'low', ...data },
      referer: '/support/create',
    })
  }

  async function latestTicket() {
    return running.db.from('escalated_tickets').orderBy('id', 'desc').first()
  }

  // ---- Create page -----------------------------------------------------------

  test('the customer create page gets the active ticket definitions in order', async ({
    assert,
  }) => {
    await standardFields()

    const visit = await customer().visit('GET', '/support/create')

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Customer/Create')
    const defs = visit.body.props.custom_fields
    assert.deepEqual(
      defs.map((d: any) => d.slug),
      ['order', 'seats', 'due', 'plan', 'areas', 'urgent', 'notes']
    )
    assert.deepEqual(Object.keys(defs[3]).sort(), [
      'description',
      'id',
      'name',
      'options',
      'placeholder',
      'position',
      'required',
      'slug',
      'type',
    ])
    assert.deepEqual(defs[3].options, ['basic', 'pro'])
    assert.strictEqual(defs[0].required, true)
  })

  // ---- Create ------------------------------------------------------------------

  test('without custom fields defined a ticket is created as before', async ({ assert }) => {
    const before = await ticketCount()

    const visit = await createTicket({})

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(await ticketCount(), before + 1)
  })

  test('a missing required field fails the create and writes no ticket', async ({ assert }) => {
    await standardFields()
    const before = await ticketCount()

    const visit = await createTicket({ custom_fields: { seats: 2 } })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, '/support/create')
    assert.equal(await ticketCount(), before)
    const back = await customer().visit('GET', '/support/create')
    assert.include(Object.keys(back.body.flash.errors ?? {}), 'custom_fields.order')

    const omitted = await createTicket({})
    assert.equal(omitted.location, '/support/create')
    assert.equal(await ticketCount(), before)
  })

  test('each type is validated, with errors keyed by slug', async ({ assert }) => {
    await standardFields()
    const before = await ticketCount()

    const visit = await createTicket({
      custom_fields: {
        order: 'A-1',
        seats: 'many',
        due: '2026-02-30',
        plan: 'gold',
        areas: ['billing', 'payroll'],
        urgent: 'maybe',
        notes: 42,
        old: 'x',
        company: 'Acme',
        nope: 'x',
      },
    })

    assert.equal(visit.status, 302)
    assert.equal(await ticketCount(), before)
    const back = await customer().visit('GET', '/support/create')
    const errors = back.body.flash.errors
    for (const slug of [
      'seats',
      'due',
      'plan',
      'areas',
      'urgent',
      'notes',
      'old',
      'company',
      'nope',
    ]) {
      assert.include(Object.keys(errors ?? {}), `custom_fields.${slug}`)
    }
    assert.notInclude(Object.keys(errors), 'custom_fields.order')
  })

  test('text is at most 255 characters and multi_select must be an array', async ({ assert }) => {
    await standardFields()

    await createTicket({ custom_fields: { order: 'x'.repeat(256), areas: 'billing' } })

    const back = await customer().visit('GET', '/support/create')
    const errors = back.body.flash.errors
    assert.include(Object.keys(errors ?? {}), 'custom_fields.order')
    assert.include(Object.keys(errors ?? {}), 'custom_fields.areas')
  })

  test('valid values are stored with the ticket and shown on its pages', async ({ assert }) => {
    await standardFields()

    const visit = await createTicket({
      custom_fields: {
        order: 'A-1',
        seats: '3',
        due: '2026-11-30',
        plan: 'pro',
        areas: ['billing', 'api'],
        urgent: 'true',
        notes: '',
      },
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const ticket = await latestTicket()
    assert.deepEqual(await storedValues(ticket.id), {
      order: 'A-1',
      seats: '3',
      due: '2026-11-30',
      plan: 'pro',
      areas: JSON.stringify(['billing', 'api']),
      urgent: '1',
    })

    const expected = {
      order: 'A-1',
      seats: 3,
      due: '2026-11-30',
      plan: 'pro',
      areas: ['billing', 'api'],
      urgent: true,
      notes: null,
    }

    const pages: Array<[InertiaClient, string, string]> = [
      [customer(), `/support/${ticket.reference}`, 'Escalated/Customer/Show'],
      [agent(), `/support/agent/tickets/${ticket.reference}`, 'Escalated/Agent/TicketShow'],
      [admin(), `/support/admin/tickets/${ticket.reference}`, 'Escalated/Admin/Tickets/Show'],
    ]
    for (const [viewer, path, component] of pages) {
      const show = await viewer.visit('GET', path)
      assert.equal(show.status, 200, `${path}: ${JSON.stringify(show.body).slice(0, 500)}`)
      assert.equal(show.body.component, component)
      const values = Object.fromEntries(
        show.body.props.custom_fields.map((f: any) => [f.slug, f.value])
      )
      assert.deepEqual(values, expected, path)
      const order = show.body.props.custom_fields[0]
      for (const key of [
        'id',
        'name',
        'slug',
        'type',
        'options',
        'required',
        'placeholder',
        'description',
        'position',
        'value',
      ]) {
        assert.property(order, key)
      }
    }
  })

  test('checkbox accepts booleans and 0/1 forms', async ({ assert }) => {
    await field({ name: 'Urgent', slug: 'urgent', type: 'checkbox' })

    for (const [input, stored] of [
      [true, '1'],
      [false, '0'],
      [0, '0'],
      ['1', '1'],
      ['false', '0'],
    ] as const) {
      const visit = await createTicket({ custom_fields: { urgent: input } })
      assert.equal(visit.status, 302)
      const ticket = await latestTicket()
      assert.deepEqual(await storedValues(ticket.id), { urgent: stored }, String(input))
    }
  })

  // ---- Update ------------------------------------------------------------------

  async function ticketWithValues() {
    await standardFields()
    await createTicket({ custom_fields: { order: 'A-1', seats: 3, plan: 'basic' } })
    return latestTicket()
  }

  function updateTicket(reference: string, data: Record<string, unknown>) {
    return agent().visit('PUT', `/support/agent/tickets/${reference}`, {
      data,
      referer: `/support/agent/tickets/${reference}`,
    })
  }

  test('an update without custom_fields changes no values', async ({ assert }) => {
    const ticket = await ticketWithValues()

    const visit = await updateTicket(ticket.reference, { subject: 'Renamed' })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.deepEqual(await storedValues(ticket.id), { order: 'A-1', seats: '3', plan: 'basic' })
  })

  test('an update checks only the keys it sends, and clears an emptied optional value', async ({
    assert,
  }) => {
    const ticket = await ticketWithValues()

    const visit = await updateTicket(ticket.reference, {
      custom_fields: { plan: 'pro', seats: '' },
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.deepEqual(await storedValues(ticket.id), { order: 'A-1', plan: 'pro' })
  })

  test('an update cannot blank a required field, and writes nothing when invalid', async ({
    assert,
  }) => {
    const ticket = await ticketWithValues()

    const visit = await updateTicket(ticket.reference, {
      subject: 'Should not save',
      custom_fields: { order: '', plan: 'pro' },
    })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `/support/agent/tickets/${ticket.reference}`)
    assert.deepEqual(await storedValues(ticket.id), { order: 'A-1', seats: '3', plan: 'basic' })
    const row = await running.db.from('escalated_tickets').where('id', ticket.id).first()
    assert.notEqual(row.subject, 'Should not save')
    const back = await agent().visit('GET', `/support/agent/tickets/${ticket.reference}`)
    assert.include(Object.keys(back.body.flash.errors ?? {}), 'custom_fields.order')
  })

  // ---- JSON API ----------------------------------------------------------------

  async function tokenFor(owner: TestUser) {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(
      { id: owner.id, constructor: { name: 'User' } },
      'custom fields test',
      ['agent']
    )
    return plainTextToken
  }

  async function api(method: string, path: string, data?: unknown) {
    const token = await tokenFor(TEST_USERS.agent)
    return new InertiaClient(running.baseUrl).visit(method, `/support/api/v1${path}`, {
      data,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
  }

  test('the API create answers 422 with errors keyed by slug and writes no ticket', async ({
    assert,
  }) => {
    await standardFields()
    const before = await ticketCount()

    const visit = await api('POST', '/tickets', {
      subject: 'API',
      description: 'Body',
      priority: 'low',
      custom_fields: { seats: 'x' },
    })

    assert.equal(visit.status, 422, JSON.stringify(visit.body))
    assert.include(Object.keys(visit.body.errors ?? {}), 'custom_fields.order')
    assert.include(Object.keys(visit.body.errors ?? {}), 'custom_fields.seats')
    assert.isArray(visit.body.errors['custom_fields.seats'])
    assert.equal(await ticketCount(), before)
  })

  test('the API create stores values and the detail carries custom_fields', async ({ assert }) => {
    await standardFields()

    const created = await api('POST', '/tickets', {
      subject: 'API',
      description: 'Body',
      priority: 'low',
      custom_fields: { order: 'B-2', areas: ['login'] },
    })

    assert.equal(created.status, 201, JSON.stringify(created.body))
    const values = Object.fromEntries(
      created.body.data.custom_fields.map((f: any) => [f.slug, f.value])
    )
    assert.equal(values.order, 'B-2')
    assert.deepEqual(values.areas, ['login'])
    assert.isNull(values.seats)

    const show = await api('GET', `/tickets/${created.body.data.reference}`)
    assert.equal(show.status, 200, JSON.stringify(show.body))
    const shown = show.body.data.custom_fields.find((f: any) => f.slug === 'order')
    assert.equal(shown.value, 'B-2')
  })
})
