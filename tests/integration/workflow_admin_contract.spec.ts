import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Workflow admin contract
|--------------------------------------------------------------------------
|
| `escalated-developer-context/domain-model/workflow-admin-contract.md` fixes
| what the shared admin UI and a backend exchange for Workflows. Before it,
| every backend's tests passed while the builder and the engines disagreed,
| because each one posted its own field names straight at its own endpoint.
|
| So these tests go over HTTP, signed in as an admin, with the contract's
| request body verbatim.
|
*/

const PREFIX = '/support/admin/workflows'

/** The request body from the contract, verbatim. */
const EXAMPLE_BODY = {
  name: 'Route refunds to billing',
  description: null,
  trigger_event: 'ticket.created',
  conditions: {
    all: [{ field: 'subject', operator: 'contains', value: 'refund' }],
  },
  actions: [
    { type: 'change_priority', value: 'high' },
    { type: 'set_department', value: '4' },
  ],
  is_active: true,
}

/** Option lists may arrive as `[{value, label}]`, `['value']` or `{value: label}`. */
function optionValues(list: unknown): string[] {
  if (Array.isArray(list)) {
    return list.map((item) => (typeof item === 'string' ? item : (item as any).value))
  }
  return Object.keys((list ?? {}) as Record<string, unknown>)
}

function decode(value: unknown) {
  return typeof value === 'string' ? JSON.parse(value) : value
}

test.group('Workflow admin contract', (group) => {
  let running: TestApp
  let client: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_workflow_logs').delete()
    await running.db.from('escalated_workflows').delete()
  })

  group.each.timeout(30_000)

  async function storedWorkflows() {
    return running.db.from('escalated_workflows').orderBy('id', 'asc')
  }

  async function createWorkflow(body: Record<string, unknown>) {
    const visit = await client.visit('POST', PREFIX, { data: body, referer: `${PREFIX}/create` })
    if (visit.status !== 302 || visit.location !== PREFIX) {
      throw new Error(
        `POST ${PREFIX} answered ${visit.status} (location ${visit.location}): ${JSON.stringify(visit.body)}`
      )
    }
    const rows = await storedWorkflows()
    return rows[rows.length - 1]
  }

  // ---- Routes --------------------------------------------------------------

  test('registers every route the admin UI calls, under the names it calls them by', async ({
    assert,
  }) => {
    const router = await running.app.container.make('router')
    const routes = Object.values(router.toJSON()).flat()

    const expected: Array<[string, string, string]> = [
      ['escalated.admin.workflows.index', 'GET', PREFIX],
      ['escalated.admin.workflows.create', 'GET', `${PREFIX}/create`],
      ['escalated.admin.workflows.store', 'POST', PREFIX],
      ['escalated.admin.workflows.edit', 'GET', `${PREFIX}/:id/edit`],
      ['escalated.admin.workflows.update', 'PUT', `${PREFIX}/:id`],
      ['escalated.admin.workflows.destroy', 'DELETE', `${PREFIX}/:id`],
      ['escalated.admin.workflows.toggle', 'POST', `${PREFIX}/:id/toggle`],
      ['escalated.admin.workflows.reorder', 'POST', `${PREFIX}/reorder`],
      ['escalated.admin.workflows.logs', 'GET', `${PREFIX}/:id/logs`],
    ]

    for (const [name, method, pattern] of expected) {
      const route = routes.find((candidate) => candidate.name === name)
      assert.exists(route, `no route named ${name}`)
      assert.include(route!.methods, method, `${name} method`)
      assert.equal(route!.pattern, pattern, `${name} pattern`)
    }
  })

  // ---- Create ---------------------------------------------------------------

  test('create: stores the contract body as sent and redirects to the index with a flash', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', PREFIX, {
      data: EXAMPLE_BODY,
      referer: `${PREFIX}/create`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)

    const rows = await storedWorkflows()
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].name, EXAMPLE_BODY.name)
    assert.equal(rows[0].trigger_event, EXAMPLE_BODY.trigger_event)
    assert.deepEqual(decode(rows[0].conditions), EXAMPLE_BODY.conditions)
    assert.deepEqual(decode(rows[0].actions), EXAMPLE_BODY.actions)
    assert.isTrue(Boolean(rows[0].is_active))

    const index = await client.visit('GET', visit.location!)
    assert.equal(index.status, 200)
    assert.equal(index.body.component, 'Escalated/Admin/Workflows/Index')
    assert.isString(index.body.flash.success)

    const [workflow] = index.body.props.workflows
    assert.isNumber(workflow.id)
    assert.equal(workflow.trigger_event, 'ticket.created')
    assert.deepEqual(workflow.conditions, EXAMPLE_BODY.conditions)
    assert.deepEqual(workflow.actions, EXAMPLE_BODY.actions)
    assert.strictEqual(workflow.is_active, true)
    assert.isNumber(workflow.position)
  })

  test('create: omitted conditions are stored as {all: []}', async ({ assert }) => {
    const body: Record<string, unknown> = { ...EXAMPLE_BODY }
    delete body.conditions
    const workflow = await createWorkflow(body)

    assert.deepEqual(decode(workflow.conditions), { all: [] })
  })

  test('create: a body without name, trigger_event or actions redirects back with errors', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', PREFIX, {
      data: { description: null, is_active: true },
      referer: `${PREFIX}/create`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, `${PREFIX}/create`)
    assert.lengthOf(await storedWorkflows(), 0)

    const form = await client.visit('GET', visit.location!)
    assert.equal(form.status, 200)
    assert.properties(form.body.flash.inputErrorsBag, ['name', 'trigger_event', 'actions'])
  })

  test('create: an empty actions list is rejected', async ({ assert }) => {
    const visit = await client.visit('POST', PREFIX, {
      data: { ...EXAMPLE_BODY, actions: [] },
      referer: `${PREFIX}/create`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, `${PREFIX}/create`)
    assert.lengthOf(await storedWorkflows(), 0)

    const form = await client.visit('GET', visit.location!)
    assert.properties(form.body.flash.inputErrorsBag, ['actions'])
    assert.notProperty(form.body.flash.inputErrorsBag, 'name')
  })

  // ---- Update ---------------------------------------------------------------

  test('update: applies the contract body and redirects to the index', async ({ assert }) => {
    const created = await createWorkflow(EXAMPLE_BODY)
    const changes = {
      name: 'Tag replies on urgent tickets',
      description: null,
      trigger_event: 'reply.created',
      conditions: { any: [{ field: 'priority', operator: 'equals', value: 'urgent' }] },
      actions: [{ type: 'add_tag', value: 'urgent-reply' }],
      is_active: false,
    }

    const visit = await client.visit('PUT', `${PREFIX}/${created.id}`, {
      data: changes,
      referer: `${PREFIX}/${created.id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)

    const [row] = await storedWorkflows()
    assert.equal(row.name, changes.name)
    assert.equal(row.trigger_event, changes.trigger_event)
    assert.deepEqual(decode(row.conditions), changes.conditions)
    assert.deepEqual(decode(row.actions), changes.actions)
    assert.isFalse(Boolean(row.is_active))

    const index = await client.visit('GET', PREFIX)
    assert.isString(index.body.flash.success)
  })

  test('update: a failing body redirects back and leaves the workflow as it was', async ({
    assert,
  }) => {
    const created = await createWorkflow(EXAMPLE_BODY)

    const visit = await client.visit('PUT', `${PREFIX}/${created.id}`, {
      data: { ...EXAMPLE_BODY, name: '', actions: [] },
      referer: `${PREFIX}/${created.id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, `${PREFIX}/${created.id}/edit`)

    const [row] = await storedWorkflows()
    assert.equal(row.name, EXAMPLE_BODY.name)
    assert.deepEqual(decode(row.actions), EXAMPLE_BODY.actions)

    const form = await client.visit('GET', visit.location!)
    assert.properties(form.body.flash.inputErrorsBag, ['name', 'actions'])
  })

  // ---- Form props -----------------------------------------------------------

  test('form: the create page renders Form with trigger_events and action_types', async ({
    assert,
  }) => {
    const page = await client.visit('GET', `${PREFIX}/create`)

    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.equal(page.body.component, 'Escalated/Admin/Workflows/Form')
    assert.isNull(page.body.props.workflow)
    assert.isNotEmpty(optionValues(page.body.props.trigger_events))
    assert.isNotEmpty(optionValues(page.body.props.action_types))
    assert.isNotEmpty(optionValues(page.body.props.operators))
  })

  test('form: the edit page renders Form with the stored workflow', async ({ assert }) => {
    const created = await createWorkflow(EXAMPLE_BODY)

    const page = await client.visit('GET', `${PREFIX}/${created.id}/edit`)

    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.equal(page.body.component, 'Escalated/Admin/Workflows/Form')
    assert.equal(page.body.props.workflow.id, created.id)
    assert.equal(page.body.props.workflow.trigger_event, 'ticket.created')
    assert.deepEqual(page.body.props.workflow.conditions, EXAMPLE_BODY.conditions)
    assert.deepEqual(page.body.props.workflow.actions, EXAMPLE_BODY.actions)
    assert.strictEqual(page.body.props.workflow.is_active, true)
    assert.isNotEmpty(optionValues(page.body.props.trigger_events))
    assert.isNotEmpty(optionValues(page.body.props.action_types))
  })

  // ---- Toggle, reorder, delete ----------------------------------------------

  test('toggle: flips is_active and redirects to the index', async ({ assert }) => {
    const created = await createWorkflow(EXAMPLE_BODY)

    const off = await client.visit('POST', `${PREFIX}/${created.id}/toggle`, { referer: PREFIX })
    assert.equal(off.status, 302, JSON.stringify(off.body))
    assert.equal(off.location, PREFIX)
    const [disabled] = await storedWorkflows()
    assert.isFalse(Boolean(disabled.is_active))

    await client.visit('POST', `${PREFIX}/${created.id}/toggle`, { referer: PREFIX })
    const [enabled] = await storedWorkflows()
    assert.isTrue(Boolean(enabled.is_active))
  })

  test('reorder: positions follow workflow_ids and the index lists them in that order', async ({
    assert,
  }) => {
    const first = await createWorkflow({ ...EXAMPLE_BODY, name: 'First' })
    const second = await createWorkflow({ ...EXAMPLE_BODY, name: 'Second' })
    const third = await createWorkflow({ ...EXAMPLE_BODY, name: 'Third' })

    const visit = await client.visit('POST', `${PREFIX}/reorder`, {
      data: { workflow_ids: [third.id, first.id, second.id] },
      referer: PREFIX,
    })
    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)

    const index = await client.visit('GET', PREFIX)
    assert.deepEqual(
      index.body.props.workflows.map((workflow: { name: string }) => workflow.name),
      ['Third', 'First', 'Second']
    )
  })

  test('delete: removes the workflow and redirects to the index', async ({ assert }) => {
    const created = await createWorkflow(EXAMPLE_BODY)

    const visit = await client.visit('DELETE', `${PREFIX}/${created.id}`, { referer: PREFIX })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)
    assert.lengthOf(await storedWorkflows(), 0)
  })
})
