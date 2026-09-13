import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
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

/** The five Workflow triggers in `domain-model/workflows-automations-macros.md`. */
const CANONICAL_TRIGGERS = [
  'ticket.created',
  'ticket.updated',
  'ticket.assigned',
  'ticket.status_changed',
  'reply.created',
]

/** The contract's core action catalog: every backend must handle these. */
const CORE_ACTIONS = [
  'change_status',
  'change_priority',
  'add_tag',
  'remove_tag',
  'set_department',
  'assign_agent',
  'add_note',
  'insert_canned_reply',
]

const requester = { id: TEST_USERS.customer.id, constructor: { name: 'User' } }

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

  async function services() {
    const { default: TicketService } = await import('../../src/services/ticket_service.js')
    const { default: AssignmentService } = await import('../../src/services/assignment_service.js')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return { tickets: new TicketService(), assignments: new AssignmentService(), Ticket }
  }

  let ticketSequence = 0

  /**
   * A stored ticket, loaded as a model, with `ticket.created` fired for it the
   * way the ticket services fire it.
   *
   * Not `TicketService.create()`: `Ticket` sets `selfAssignPrimaryKey = true`
   * while its table has an auto-increment id, so Lucid never reads the new id
   * back and `create()` fails writing the activity row before it emits the
   * event. That is fixed separately.
   */
  async function openTicket(subject: string) {
    const { Ticket } = await services()
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')

    const reference = `WF-${++ticketSequence}`
    await running.db.table('escalated_tickets').insert({
      reference,
      requester_type: 'User',
      requester_id: requester.id,
      subject,
      description: 'Opened by the workflow contract tests',
      status: 'open',
      priority: 'low',
      ticket_type: 'question',
      channel: 'web',
      sla_first_response_breached: false,
      sla_resolution_breached: false,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })

    const ticket = await Ticket.findByOrFail('reference', reference)
    await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })
    return ticket
  }

  async function reloadTicket(id: number) {
    const { Ticket } = await services()
    return Ticket.findOrFail(id)
  }

  async function tagNames(ticketId: number): Promise<string[]> {
    const rows = await running.db
      .from('escalated_ticket_tag')
      .join('escalated_tags', 'escalated_tags.id', 'escalated_ticket_tag.tag_id')
      .where('escalated_ticket_tag.ticket_id', ticketId)
      .select('escalated_tags.name')
    return rows.map((row: { name: string }) => row.name)
  }

  async function ensureDepartment(id: number) {
    const existing = await running.db.from('escalated_departments').where('id', id).first()
    if (!existing) {
      await running.db.table('escalated_departments').insert({
        id,
        name: `Department ${id}`,
        slug: `department-${id}`,
        created_at: sqlTimestamp(),
        updated_at: sqlTimestamp(),
      })
    }
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

  test('create: a trigger event the package never fires is rejected', async ({ assert }) => {
    const visit = await client.visit('POST', PREFIX, {
      data: { ...EXAMPLE_BODY, trigger_event: 'ticket.priority_changed' },
      referer: `${PREFIX}/create`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, `${PREFIX}/create`)
    assert.lengthOf(await storedWorkflows(), 0)

    const form = await client.visit('GET', visit.location!)
    assert.properties(form.body.flash.inputErrorsBag, ['trigger_event'])
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

  test('form: trigger_events are the events that run workflows; action_types hold the core catalog', async ({
    assert,
  }) => {
    const page = await client.visit('GET', `${PREFIX}/create`)
    assert.equal(page.status, 200, JSON.stringify(page.body))

    // The UI shows exactly the triggers it is given, so the list must be the
    // events this backend fires -- each one is shown running a workflow below.
    assert.sameMembers(optionValues(page.body.props.trigger_events), CANONICAL_TRIGGERS)

    const actionTypes = optionValues(page.body.props.action_types)
    for (const action of CORE_ACTIONS) {
      assert.include(actionTypes, action, `action_types is missing ${action}`)
    }
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

  // ---- Execution ------------------------------------------------------------

  test('execution: a workflow saved from the contract body runs on a matching ticket', async ({
    assert,
  }) => {
    await ensureDepartment(4)
    await createWorkflow(EXAMPLE_BODY)

    const refund = await openTicket('Please refund my order')
    const other = await openTicket('Password reset')

    const refundAfter = await reloadTicket(refund.id)
    assert.equal(refundAfter.priority, 'high')
    assert.equal(refundAfter.departmentId, 4)

    const otherAfter = await reloadTicket(other.id)
    assert.equal(otherAfter.priority, 'low')
    assert.isNull(otherAfter.departmentId)

    const logs = await running.db.from('escalated_workflow_logs').where('ticket_id', refund.id)
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].status, 'success')
  })

  test('execution: a workflow on {event} runs when the package fires it')
    .with([
      {
        event: 'ticket.created',
        fire: async () => {
          const ticket = await openTicket('Created')
          return ticket.id
        },
      },
      {
        event: 'ticket.updated',
        fire: async () => {
          const ticket = await openTicket('Before the update')
          const { tickets } = await services()
          await tickets.update(ticket, { subject: 'After the update' })
          return ticket.id
        },
      },
      {
        event: 'ticket.status_changed',
        fire: async () => {
          const ticket = await openTicket('Status change')
          const { tickets } = await services()
          await tickets.changeStatus(ticket, 'in_progress', requester)
          return ticket.id
        },
      },
      {
        event: 'ticket.assigned',
        fire: async () => {
          const ticket = await openTicket('Assignment')
          const { assignments } = await services()
          await assignments.assign(ticket, TEST_USERS.agent.id, requester)
          return ticket.id
        },
      },
      {
        event: 'reply.created',
        fire: async () => {
          const ticket = await openTicket('Reply')
          const { tickets } = await services()
          await tickets.reply(ticket, requester, 'A reply from the customer')
          return ticket.id
        },
      },
    ])
    .run(async ({ assert }, { event, fire }) => {
      const tag = `fired-${event.replace(/\W/g, '-')}`
      await createWorkflow({
        ...EXAMPLE_BODY,
        name: `Tag on ${event}`,
        trigger_event: event,
        conditions: { all: [] },
        actions: [{ type: 'add_tag', value: tag }],
      })

      const ticketId = await fire()

      assert.include(await tagNames(ticketId), tag)
    })

  test('execution: add_note and insert_canned_reply write to the ticket', async ({ assert }) => {
    await createWorkflow({
      ...EXAMPLE_BODY,
      conditions: { all: [] },
      actions: [
        { type: 'add_note', value: 'Routed {{reference}} automatically' },
        { type: 'insert_canned_reply', value: 'Thanks for writing in. We are on it.' },
      ],
    })

    const ticket = await openTicket('Anything at all')
    const replies = await running.db.from('escalated_replies').where('ticket_id', ticket.id)

    const note = replies.find((reply: any) => Boolean(reply.is_internal_note))
    const reply = replies.find((candidate: any) => !candidate.is_internal_note)
    assert.equal(note?.body, `Routed ${ticket.reference} automatically`)
    assert.equal(note?.type, 'note')
    assert.equal(reply?.body, 'Thanks for writing in. We are on it.')
  })

  test('execution: an empty any list matches every ticket', async ({ assert }) => {
    await createWorkflow({ ...EXAMPLE_BODY, conditions: { any: [] } })

    const ticket = await openTicket('Nothing to do with money')
    const after = await reloadTicket(ticket.id)

    assert.equal(after.priority, 'high')
  })

  test('execution: a disabled workflow does not run', async ({ assert }) => {
    await createWorkflow({ ...EXAMPLE_BODY, is_active: false })

    const ticket = await openTicket('Please refund my order')
    const after = await reloadTicket(ticket.id)

    assert.equal(after.priority, 'low')
  })

  // ---- Shapes already stored ------------------------------------------------

  test('stored shapes: a flat condition list is still evaluated as all', async ({ assert }) => {
    await running.db.table('escalated_workflows').insert({
      name: 'Stored as a flat list',
      trigger_event: 'ticket.created',
      conditions: JSON.stringify([{ field: 'subject', operator: 'contains', value: 'refund' }]),
      actions: JSON.stringify([{ type: 'change_priority', value: 'urgent' }]),
      is_active: true,
      position: 0,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })

    const refund = await openTicket('A refund, please')
    const other = await openTicket('Something else')

    const refundAfter = await reloadTicket(refund.id)
    const otherAfter = await reloadTicket(other.id)
    assert.equal(refundAfter.priority, 'urgent')
    assert.equal(otherAfter.priority, 'low')
  })

  test('stored shapes: {} conditions, the old default for omitted ones, match every ticket', async ({
    assert,
  }) => {
    await running.db.table('escalated_workflows').insert({
      name: 'Stored before conditions defaulted to all',
      trigger_event: 'ticket.created',
      conditions: JSON.stringify({}),
      actions: JSON.stringify([{ type: 'change_priority', value: 'urgent' }]),
      is_active: true,
      position: 0,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })

    const ticket = await openTicket('Any subject')
    const after = await reloadTicket(ticket.id)

    assert.equal(after.priority, 'urgent')
  })
})
