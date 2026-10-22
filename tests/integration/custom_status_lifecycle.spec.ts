import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS, type TestUser } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Custom statuses in the ticket lifecycle
|--------------------------------------------------------------------------
|
| A custom status belongs to a category, and a ticket that takes one moves to
| that category's built-in anchor status (new/open -> open, pending ->
| waiting_on_customer, on_hold -> in_progress, solved -> resolved) through the
| normal status change, so everything the anchor triggers still happens. The
| built-in `status` column stays the source of truth for the lifecycle;
| `ticket_status_id` records the sub-status. Setting a built-in status clears
| it. Customers see the built-in status only.
|
*/

const ADMIN = '/support/admin'
const AGENT = '/support/agent'

test.group('Custom statuses in the ticket lifecycle', (group) => {
  let running: TestApp
  let admin: InertiaClient
  let agent: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    admin = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    await running.db.from('escalated_tickets').update({ ticket_status_id: null })
    await running.db.from('escalated_ticket_statuses').where('is_system', false).delete()
  })

  group.each.timeout(30_000)

  let sequence = 0

  async function openTicket(overrides: Record<string, unknown> = {}) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `CST-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject: 'Custom status lifecycle',
      description: 'Opened by the custom status tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
      ...overrides,
    } as any)
  }

  async function customStatus(slug: string, category: string, label = slug) {
    const { default: CustomStatus } = await import('../../src/models/custom_status.js')
    return CustomStatus.create({
      label,
      slug,
      category,
      color: '#8b5cf6',
      position: 0,
      isDefault: false,
      isSystem: false,
    } as any)
  }

  async function stored(id: number) {
    return running.db.from('escalated_tickets').where('id', id).first()
  }

  async function storedField(id: number, column: string) {
    const found = await stored(id)
    return found[column]
  }

  async function capture(event: string, cleanup: (fn: () => void) => void) {
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const seen: any[] = []
    const listener = (data: any) => seen.push(data)
    emitter.on(event as any, listener)
    cleanup(() => emitter.off(event as any, listener))
    return seen
  }

  async function events() {
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    return ESCALATED_EVENTS
  }

  function api(method: string, path: string, token: string, data?: unknown) {
    return new InertiaClient(running.baseUrl).visit(method, `/support/api/v1${path}`, {
      data,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
  }

  async function tokenFor(owner: TestUser) {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(
      { id: owner.id, constructor: { name: 'User' } },
      'custom statuses',
      ['agent']
    )
    return plainTextToken
  }

  // ---- Setting a custom status --------------------------------------------------

  test('a solved-category status resolves the ticket the way the built-in does', async ({
    assert,
    cleanup,
  }) => {
    const E = await events()
    const changed = await capture(E.TICKET_STATUS_CHANGED, cleanup)
    const resolved = await capture(E.TICKET_RESOLVED, cleanup)
    const solved = await customStatus('fixed_in_release', 'solved', 'Fixed in release')
    const ticket = await openTicket()

    const visit = await admin.visit('POST', `${ADMIN}/tickets/${ticket.reference}/status`, {
      data: { status: 'fixed_in_release' },
      referer: `${ADMIN}/tickets/${ticket.reference}`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const row = await stored(ticket.id)
    assert.equal(row.status, 'resolved')
    assert.equal(Number(row.ticket_status_id), solved.id)
    assert.isNotNull(row.resolved_at)

    const event = changed.find((e) => e.ticket.id === ticket.id)
    assert.equal(event.oldStatus, 'open')
    assert.equal(event.newStatus, 'resolved')
    assert.isNull(event.oldCustomStatus)
    assert.equal(event.newCustomStatus, 'fixed_in_release')
    assert.equal(event.oldCategory, 'open')
    assert.equal(event.newCategory, 'solved')
    assert.isTrue(resolved.some((e) => e.ticket.id === ticket.id))
  })

  test('SLA breach checks skip a ticket in a solved-category custom status', async ({ assert }) => {
    await customStatus('shipped', 'solved')
    const overdue = { resolutionDueAt: DateTime.now().minus({ hours: 2 }) }
    const parked = await openTicket(overdue)
    const control = await openTicket(overdue)

    const visit = await agent.visit('POST', `${AGENT}/tickets/${parked.reference}/status`, {
      data: { status: 'shipped' },
    })
    assert.equal(visit.status, 302, JSON.stringify(visit.body))

    const { default: SlaService } = await import('../../src/services/sla_service.js')
    await new SlaService().checkBreaches()

    assert.isFalse(Boolean(await storedField(parked.id, 'sla_resolution_breached')))
    assert.isTrue(Boolean(await storedField(control.id, 'sla_resolution_breached')))
  })

  test('a pending-category status maps to waiting_on_customer', async ({ assert }) => {
    const pending = await customStatus('awaiting_logs', 'pending')
    const ticket = await openTicket()

    const visit = await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_logs' },
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const row = await stored(ticket.id)
    assert.equal(row.status, 'waiting_on_customer')
    assert.equal(Number(row.ticket_status_id), pending.id)
  })

  test('on_hold maps to in_progress and new maps to open', async ({ assert }) => {
    await customStatus('parked', 'on_hold')
    await customStatus('triage', 'new')
    const ticket = await openTicket()

    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'parked' },
    })
    assert.equal(await storedField(ticket.id, 'status'), 'in_progress')

    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'waiting_on_agent' },
    })
    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'triage' },
    })
    assert.equal(await storedField(ticket.id, 'status'), 'open')
  })

  test('a move between two statuses of one category still fires ticket.status_changed', async ({
    assert,
    cleanup,
  }) => {
    const E = await events()
    const changed = await capture(E.TICKET_STATUS_CHANGED, cleanup)
    await customStatus('awaiting_logs', 'pending')
    const second = await customStatus('awaiting_approval', 'pending')
    const ticket = await openTicket()

    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_logs' },
    })
    const visit = await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_approval' },
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const row = await stored(ticket.id)
    assert.equal(row.status, 'waiting_on_customer')
    assert.equal(Number(row.ticket_status_id), second.id)
    const forTicket = changed.filter((e) => e.ticket.id === ticket.id)
    assert.lengthOf(forTicket, 2)
    assert.equal(forTicket[1].oldStatus, 'waiting_on_customer')
    assert.equal(forTicket[1].newStatus, 'waiting_on_customer')
    assert.equal(forTicket[1].oldCustomStatus, 'awaiting_logs')
    assert.equal(forTicket[1].newCustomStatus, 'awaiting_approval')
  })

  test('setting a built-in status clears the custom status', async ({ assert }) => {
    await customStatus('awaiting_logs', 'pending')
    const ticket = await openTicket()
    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_logs' },
    })

    const visit = await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'in_progress' },
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const row = await stored(ticket.id)
    assert.equal(row.status, 'in_progress')
    assert.isNull(row.ticket_status_id)
  })

  test('setting the anchor built-in itself clears the custom status too', async ({ assert }) => {
    await customStatus('awaiting_logs', 'pending')
    const ticket = await openTicket()
    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_logs' },
    })

    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'waiting_on_customer' },
    })

    const row = await stored(ticket.id)
    assert.equal(row.status, 'waiting_on_customer')
    assert.isNull(row.ticket_status_id)
  })

  test('snoozing a ticket clears its custom status', async ({ assert }) => {
    await customStatus('awaiting_logs', 'pending')
    const ticket = await openTicket()
    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_logs' },
    })

    const { default: Ticket } = await import('../../src/models/ticket.js')
    const { default: TicketService } = await import('../../src/services/ticket_service.js')
    await new TicketService().snoozeTicket(
      await Ticket.findOrFail(ticket.id),
      DateTime.now().plus({ days: 1 }),
      { id: TEST_USERS.agent.id, constructor: { name: 'User' } }
    )

    assert.isNull(await storedField(ticket.id, 'ticket_status_id'))
  })

  test('deleting a custom status nulls tickets and leaves their status valid', async ({
    assert,
  }) => {
    const pending = await customStatus('awaiting_logs', 'pending')
    const ticket = await openTicket()
    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_logs' },
    })

    const visit = await admin.visit('DELETE', `${ADMIN}/statuses/${pending.id}`)

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const row = await stored(ticket.id)
    assert.isNull(row.ticket_status_id)
    assert.equal(row.status, 'waiting_on_customer')
  })

  test('changing a status category does not rewrite tickets already in it', async ({ assert }) => {
    const status = await customStatus('awaiting_logs', 'pending')
    const ticket = await openTicket()
    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_logs' },
    })

    await admin.visit('PUT', `${ADMIN}/statuses/${status.id}`, {
      data: { label: 'Awaiting logs', category: 'on_hold', color: '#000000' },
    })

    const row = await stored(ticket.id)
    assert.equal(row.status, 'waiting_on_customer')
    assert.equal(Number(row.ticket_status_id), status.id)
  })

  test('an unknown status is still rejected', async ({ assert }) => {
    const ticket = await openTicket()
    const token = await tokenFor(TEST_USERS.agent)

    const visit = await api('PATCH', `/tickets/${ticket.reference}/status`, token, {
      status: 'no_such_status',
    })

    assert.equal(visit.status, 422, JSON.stringify(visit.body))
    assert.equal(await storedField(ticket.id, 'status'), 'open')
  })

  test('a transition the anchor does not allow is rejected', async ({ assert }) => {
    await customStatus('awaiting_logs', 'pending')
    const ticket = await openTicket({ status: 'closed' })
    const token = await tokenFor(TEST_USERS.agent)

    const visit = await api('PATCH', `/tickets/${ticket.reference}/status`, token, {
      status: 'awaiting_logs',
    })

    assert.equal(visit.status, 422, JSON.stringify(visit.body))
    const row = await stored(ticket.id)
    assert.equal(row.status, 'closed')
    assert.isNull(row.ticket_status_id)
  })

  // ---- The other status-change inputs -------------------------------------------

  test('the API status endpoint accepts a custom slug and shows it on the ticket', async ({
    assert,
  }) => {
    const pending = await customStatus('awaiting_logs', 'pending', 'Awaiting logs')
    const ticket = await openTicket()
    const token = await tokenFor(TEST_USERS.agent)

    const visit = await api('PATCH', `/tickets/${ticket.reference}/status`, token, {
      status: 'awaiting_logs',
    })

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(await storedField(ticket.id, 'status'), 'waiting_on_customer')

    const show = await api('GET', `/tickets/${ticket.reference}`, token)
    assert.equal(show.status, 200, JSON.stringify(show.body))
    assert.deepEqual(show.body.data.custom_status, {
      id: pending.id,
      label: 'Awaiting logs',
      slug: 'awaiting_logs',
      color: '#8b5cf6',
      category: 'pending',
    })
    assert.equal(show.body.data.status_category, 'pending')

    const list = await api('GET', `/tickets?status=awaiting_logs`, token)
    assert.equal(list.status, 200, JSON.stringify(list.body))
    const row = list.body.data.find((t: any) => t.id === ticket.id)
    assert.exists(row)
    assert.equal(row.custom_status.slug, 'awaiting_logs')
    assert.equal(row.status_category, 'pending')
  })

  test('the bulk status action accepts a custom slug', async ({ assert }) => {
    const parked = await customStatus('parked', 'on_hold')
    const one = await openTicket()
    const two = await openTicket()

    const visit = await agent.visit('POST', `${AGENT}/tickets/bulk`, {
      data: { ticket_ids: [one.id, two.id], action: 'status', value: 'parked' },
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    for (const id of [one.id, two.id]) {
      const row = await stored(id)
      assert.equal(row.status, 'in_progress')
      assert.equal(Number(row.ticket_status_id), parked.id)
    }
  })

  test('a macro status action accepts a custom slug', async ({ assert }) => {
    const solved = await customStatus('fixed_in_release', 'solved')
    const { default: Macro } = await import('../../src/models/macro.js')
    const macro = await Macro.create({
      name: 'Ship it',
      description: null,
      actions: [{ type: 'status', value: 'fixed_in_release' }],
      isShared: true,
      order: 0,
      createdBy: TEST_USERS.admin.id,
    } as any)
    const ticket = await openTicket()

    const visit = await admin.visit('POST', `${ADMIN}/tickets/${ticket.reference}/macro`, {
      data: { macro_id: macro.id },
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const row = await stored(ticket.id)
    assert.equal(row.status, 'resolved')
    assert.equal(Number(row.ticket_status_id), solved.id)
    assert.isNotNull(row.resolved_at)
    await macro.delete()
  })

  test('a workflow change_status action accepts a custom slug, and a built-in clears it', async ({
    assert,
  }) => {
    const pending = await customStatus('awaiting_logs', 'pending')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const { default: WorkflowEngine } = await import('../../src/services/workflow_engine.js')
    const ticket = await openTicket()
    await running.db.from('escalated_workflows').delete()
    await running.db.table('escalated_workflows').insert({
      name: 'Park on create',
      trigger_event: 'ticket.created',
      conditions: JSON.stringify({}),
      actions: JSON.stringify([{ type: 'change_status', value: 'awaiting_logs' }]),
      is_active: true,
      position: 0,
    })
    const workflow = await running.db.from('escalated_workflows').first()

    await new WorkflowEngine().processEvent('ticket.created', await Ticket.findOrFail(ticket.id))

    let row = await stored(ticket.id)
    assert.equal(row.status, 'waiting_on_customer')
    assert.equal(Number(row.ticket_status_id), pending.id)

    await running.db
      .from('escalated_workflows')
      .where('id', workflow.id)
      .update({ actions: JSON.stringify([{ type: 'change_status', value: 'in_progress' }]) })
    await new WorkflowEngine().processEvent('ticket.created', await Ticket.findOrFail(ticket.id))

    row = await stored(ticket.id)
    assert.equal(row.status, 'in_progress')
    assert.isNull(row.ticket_status_id)
    await running.db.from('escalated_workflow_logs').delete()
    await running.db.from('escalated_workflows').delete()
  })

  // ---- What each audience sees ---------------------------------------------------

  test('agent and admin pages carry custom_status and status_category', async ({ assert }) => {
    const pending = await customStatus('awaiting_logs', 'pending', 'Awaiting logs')
    const ticket = await openTicket()
    const plain = await openTicket()
    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_logs' },
    })

    for (const client of [admin, agent]) {
      const base = client === admin ? ADMIN : AGENT
      const show = await client.visit('GET', `${base}/tickets/${ticket.reference}`)
      assert.equal(show.status, 200, JSON.stringify(show.body))
      assert.deepEqual(show.body.props.ticket.custom_status, {
        id: pending.id,
        label: 'Awaiting logs',
        slug: 'awaiting_logs',
        color: '#8b5cf6',
        category: 'pending',
      })
      assert.equal(show.body.props.ticket.status_category, 'pending')

      const index = await client.visit('GET', `${base}/tickets?status=awaiting_logs`)
      assert.equal(index.status, 200, JSON.stringify(index.body))
      const rows = index.body.props.tickets.data
      assert.deepEqual(
        rows.map((r: any) => r.id),
        [ticket.id]
      )
      assert.equal(rows[0].custom_status.slug, 'awaiting_logs')
      assert.equal(rows[0].status_category, 'pending')

      const other = await client.visit('GET', `${base}/tickets/${plain.reference}`)
      assert.isNull(other.body.props.ticket.custom_status)
      assert.equal(other.body.props.ticket.status_category, 'open')
    }
  })

  test('the customer view shows the built-in status, not the custom label', async ({ assert }) => {
    await customStatus('awaiting_vendor_x', 'pending', 'Secret vendor label')
    const ticket = await openTicket()
    await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/status`, {
      data: { status: 'awaiting_vendor_x' },
    })
    const customer = new InertiaClient(running.baseUrl, { user: TEST_USERS.customer })

    const visit = await customer.visit('GET', `/support/${ticket.reference}`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.props.ticket.status, 'waiting_on_customer')
    const text = JSON.stringify(visit.body)
    assert.notInclude(text, 'Secret vendor label')
    assert.notInclude(text, 'awaiting_vendor_x')
    assert.notProperty(visit.body.props.ticket, 'custom_status')
    assert.notProperty(visit.body.props.ticket, 'ticket_status_id')
  })
})
