import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Custom ticket status admin pages
|--------------------------------------------------------------------------
|
| The shared Statuses/Index and Statuses/Form pages, with the props and
| redirects of escalated-laravel's Admin\StatusController, plus the system
| rows (one per built-in status) that the cross-port statuses spec adds:
| their slug and category are fixed and they cannot be deleted.
|
*/

const PREFIX = '/support/admin/statuses'
const CATEGORIES = ['new', 'open', 'pending', 'on_hold', 'solved']
const STATUS_KEYS = [
  'id',
  'label',
  'slug',
  'category',
  'color',
  'description',
  'position',
  'is_default',
  'is_system',
  'created_at',
  'updated_at',
]

test.group('Custom status admin pages', (group) => {
  let running: TestApp
  let client: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_tickets').update({ ticket_status_id: null })
    await running.db.from('escalated_ticket_statuses').where('is_system', false).delete()
  })

  group.each.timeout(30_000)

  async function customStatus(overrides: Record<string, unknown> = {}) {
    const { default: CustomStatus } = await import('../../src/models/custom_status.js')
    return CustomStatus.create({
      label: 'Awaiting parts',
      slug: 'awaiting_parts',
      category: 'on_hold',
      color: '#123456',
      description: 'Parts are on order',
      position: 3,
      isDefault: false,
      isSystem: false,
      ...overrides,
    } as any)
  }

  async function row(id: number) {
    return running.db.from('escalated_ticket_statuses').where('id', id).first()
  }

  async function rowField(id: number, column: string) {
    const found = await row(id)
    return found[column]
  }

  test('index renders Statuses/Index with every status and the five categories', async ({
    assert,
  }) => {
    const custom = await customStatus()

    const visit = await client.visit('GET', PREFIX)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Statuses/Index')
    assert.deepEqual(visit.body.props.categories, CATEGORIES)

    const statuses = visit.body.props.statuses
    const found = statuses.find((s: any) => s.id === custom.id)
    assert.exists(found)
    assert.sameMembers(Object.keys(found), STATUS_KEYS)
    assert.equal(found.label, 'Awaiting parts')
    assert.equal(found.slug, 'awaiting_parts')
    assert.equal(found.category, 'on_hold')
    assert.equal(found.color, '#123456')
    assert.equal(found.description, 'Parts are on order')
    assert.equal(found.position, 3)
    assert.strictEqual(found.is_default, false)
    assert.strictEqual(found.is_system, false)

    // The built-ins are listed as system rows, under their categories.
    const system = Object.fromEntries(
      statuses.filter((s: any) => s.is_system).map((s: any) => [s.slug, s.category])
    )
    assert.deepEqual(system, {
      open: 'open',
      in_progress: 'open',
      waiting_on_customer: 'pending',
      waiting_on_agent: 'open',
      escalated: 'open',
      reopened: 'open',
      resolved: 'solved',
      closed: 'solved',
    })

    // Ordered by category, then position.
    const order = statuses.map((s: any) => [s.category, s.position])
    const sorted = [...order].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1))
    assert.deepEqual(order, sorted)
  })

  test('create renders Statuses/Form with the categories and no status', async ({ assert }) => {
    const visit = await client.visit('GET', `${PREFIX}/create`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Statuses/Form')
    assert.deepEqual(visit.body.props.categories, CATEGORIES)
    assert.notExists(visit.body.props.status)
  })

  test('edit renders Statuses/Form with the status and the categories', async ({ assert }) => {
    const custom = await customStatus()

    const visit = await client.visit('GET', `${PREFIX}/${custom.id}/edit`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Statuses/Form')
    assert.deepEqual(visit.body.props.categories, CATEGORIES)
    const status = visit.body.props.status
    assert.sameMembers(Object.keys(status), STATUS_KEYS)
    assert.equal(status.id, custom.id)
    assert.equal(status.label, 'Awaiting parts')
    assert.equal(status.category, 'on_hold')
  })

  test('edit of a missing status is a 404', async ({ assert }) => {
    const visit = await client.visit('GET', `${PREFIX}/999999/edit`)
    assert.equal(visit.status, 404)
  })

  test('store creates the status with a generated slug and redirects to the index', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', PREFIX, {
      data: {
        label: 'Waiting on Vendor!',
        category: 'pending',
        color: '#ff0000',
        description: '',
        position: 2,
        is_default: false,
      },
      referer: `${PREFIX}/create`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)
    const stored = await running.db
      .from('escalated_ticket_statuses')
      .where('slug', 'waiting_on_vendor')
      .first()
    assert.exists(stored)
    assert.equal(stored.category, 'pending')
    assert.equal(stored.color, '#ff0000')
    assert.equal(Number(stored.position), 2)
    assert.isFalse(Boolean(stored.is_system))

    const index = await client.visit('GET', PREFIX)
    assert.equal(index.body.flash.success, 'Status created.')
  })

  test('store de-duplicates a slug, including against the built-ins', async ({ assert }) => {
    for (const label of ['Escalated', 'Escalated']) {
      const visit = await client.visit('POST', PREFIX, {
        data: { label, category: 'open', color: '#000000' },
        referer: `${PREFIX}/create`,
      })
      assert.equal(visit.status, 302, JSON.stringify(visit.body))
    }

    const rows = await running.db
      .from('escalated_ticket_statuses')
      .where('is_system', false)
      .orderBy('id')
      .select('slug')
    assert.deepEqual(
      rows.map((r: any) => r.slug),
      ['escalated_2', 'escalated_3']
    )
  })

  test('an invalid form goes back with field errors and stores nothing', async ({ assert }) => {
    const visit = await client.visit('POST', PREFIX, {
      data: { label: '', category: 'bogus', color: 'x'.repeat(21), position: 'abc' },
      referer: `${PREFIX}/create`,
    })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${PREFIX}/create`)
    const custom = await running.db.from('escalated_ticket_statuses').where('is_system', false)
    assert.lengthOf(custom, 0)

    const form = await client.visit('GET', `${PREFIX}/create`)
    assert.properties(form.body.flash.errors, ['label', 'category', 'color', 'position'])
  })

  test('is_default clears the flag on the other statuses of that category', async ({ assert }) => {
    const first = await customStatus({ slug: 'first', isDefault: true, category: 'on_hold' })
    const elsewhere = await customStatus({ slug: 'other', isDefault: true, category: 'pending' })

    const visit = await client.visit('POST', PREFIX, {
      data: { label: 'Second', category: 'on_hold', color: '#000000', is_default: true },
      referer: `${PREFIX}/create`,
    })
    assert.equal(visit.status, 302, JSON.stringify(visit.body))

    assert.isFalse(Boolean(await rowField(first.id, 'is_default')))
    assert.isTrue(Boolean(await rowField(elsewhere.id, 'is_default')))
    const second = await running.db
      .from('escalated_ticket_statuses')
      .where('slug', 'second')
      .first()
    assert.isTrue(Boolean(second.is_default))

    // And on update.
    const update = await client.visit('PUT', `${PREFIX}/${first.id}`, {
      data: { label: 'First', category: 'on_hold', color: '#000000', is_default: true },
      referer: `${PREFIX}/${first.id}/edit`,
    })
    assert.equal(update.status, 302, JSON.stringify(update.body))
    assert.isTrue(Boolean(await rowField(first.id, 'is_default')))
    assert.isFalse(Boolean(await rowField(second.id, 'is_default')))
  })

  test('update saves the status and redirects to the index', async ({ assert }) => {
    const custom = await customStatus()

    const visit = await client.visit('PUT', `${PREFIX}/${custom.id}`, {
      data: {
        label: 'Parts ordered',
        category: 'pending',
        color: '#abcdef',
        description: 'Changed',
        position: 7,
        is_default: false,
      },
      referer: `${PREFIX}/${custom.id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)
    const stored = await row(custom.id)
    assert.equal(stored.label, 'Parts ordered')
    assert.equal(stored.category, 'pending')
    assert.equal(stored.color, '#abcdef')
    assert.equal(stored.description, 'Changed')
    assert.equal(Number(stored.position), 7)
    // The slug is kept, so workflows and macros that name it keep working.
    assert.equal(stored.slug, 'awaiting_parts')
  })

  test('PATCH updates too', async ({ assert }) => {
    const custom = await customStatus()

    const visit = await client.visit('PATCH', `${PREFIX}/${custom.id}`, {
      data: { label: 'Patched', category: 'on_hold', color: '#000000' },
      referer: `${PREFIX}/${custom.id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(await rowField(custom.id, 'label'), 'Patched')
  })

  test('a system status keeps its slug and category; label and colour can change', async ({
    assert,
  }) => {
    const system = await running.db
      .from('escalated_ticket_statuses')
      .where('slug', 'waiting_on_customer')
      .first()
    const original = { label: system.label, color: system.color }

    const moved = await client.visit('PUT', `${PREFIX}/${system.id}`, {
      data: { label: 'Customer', category: 'on_hold', color: '#111111' },
      referer: `${PREFIX}/${system.id}/edit`,
    })
    assert.equal(moved.status, 302)
    assert.equal(moved.location, `${PREFIX}/${system.id}/edit`)
    assert.equal(await rowField(system.id, 'category'), 'pending')
    const form = await client.visit('GET', `${PREFIX}/${system.id}/edit`)
    assert.property(form.body.flash.errors, 'category')

    const relabelled = await client.visit('PUT', `${PREFIX}/${system.id}`, {
      data: { label: 'Waiting on you', category: 'pending', color: '#222222', slug: 'renamed' },
      referer: `${PREFIX}/${system.id}/edit`,
    })
    assert.equal(relabelled.status, 302, JSON.stringify(relabelled.body))
    assert.equal(relabelled.location, PREFIX)
    const stored = await row(system.id)
    assert.equal(stored.label, 'Waiting on you')
    assert.equal(stored.color, '#222222')
    assert.equal(stored.slug, 'waiting_on_customer')

    await running.db
      .from('escalated_ticket_statuses')
      .where('id', system.id)
      .update({ label: original.label, color: original.color })
  })

  test('destroy deletes a custom status and redirects to the index', async ({ assert }) => {
    const custom = await customStatus()

    const visit = await client.visit('DELETE', `${PREFIX}/${custom.id}`, { referer: PREFIX })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)
    assert.notExists(await row(custom.id))
    const index = await client.visit('GET', PREFIX)
    assert.equal(index.body.flash.success, 'Status deleted.')
  })

  test('a system status cannot be deleted', async ({ assert }) => {
    const system = await running.db
      .from('escalated_ticket_statuses')
      .where('slug', 'resolved')
      .first()

    const visit = await client.visit('DELETE', `${PREFIX}/${system.id}`, { referer: PREFIX })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, PREFIX)
    assert.exists(await row(system.id))
    const index = await client.visit('GET', PREFIX)
    assert.exists(index.body.flash.error)
  })

  test('a non-admin cannot reach the pages or the writes', async ({ assert }) => {
    const custom = await customStatus()
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })

    for (const [method, path] of [
      ['GET', PREFIX],
      ['GET', `${PREFIX}/create`],
      ['GET', `${PREFIX}/${custom.id}/edit`],
      ['POST', PREFIX],
      ['PUT', `${PREFIX}/${custom.id}`],
      ['DELETE', `${PREFIX}/${custom.id}`],
    ]) {
      const visit = await agent.visit(method, path, {
        data: method === 'GET' ? undefined : { label: 'x', category: 'open', color: '#000' },
      })
      assert.equal(visit.status, 403, `${method} ${path}`)
    }
    assert.exists(await row(custom.id))
  })
})
