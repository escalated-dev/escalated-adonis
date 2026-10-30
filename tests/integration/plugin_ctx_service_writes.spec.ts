import { test } from '@japa/runner'
import { testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| ctx ticket and reply writes go through TicketService
|--------------------------------------------------------------------------
|
| domain-model/plugin-contract.md: ctx.tickets.create/update and
| ctx.replies.create go through the host's ticket service, so a plugin's
| ticket or reply gets the same activity log, SLA, canonical events,
| workflows and webhooks as one written over the HTTP API. They wrote the
| models directly, so none of that ran. A plugin's own write does not
| re-deliver the event it is handling back to plugins.
|
*/

test.group('Plugin ctx writes through the ticket service', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  let sequence = 0

  async function openTicket(subject: string, extra: Record<string, unknown> = {}) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `SVC-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject,
      description: 'Opened by the ctx service-write tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
      ...extra,
    } as any)
  }

  async function hooks() {
    return (await running.app.container.make('escalated.hookManager')) as any
  }

  /** Collects what native plugins' action callbacks receive. */
  async function listen(names: string[]) {
    const manager = await hooks()
    const seen: Array<[string, any]> = []
    const callbacks = names.map((name) => {
      const callback = (payload: any) => {
        seen.push([name, payload])
      }
      manager.addAction(name, callback)
      return [name, callback] as const
    })
    const on = (name: string, callback: (payload: any) => unknown) => {
      manager.addAction(name, callback)
      callbacks.push([name, callback] as const)
    }
    const stop = () => callbacks.forEach(([name, cb]) => manager.removeAction(name, cb))
    // Other specs' deliveries may still be in flight: only this ticket's.
    const about = (ticketId: number) =>
      seen
        .filter(([, payload]) => (payload.ticket?.id ?? payload.id) === ticketId)
        .map(([name]) => name)
    return { seen, on, stop, about }
  }

  async function settle(ms = 400) {
    await new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function context(pluginName = 'acme') {
    const { default: NativeContext } = await import('../../src/bridge/native_context.js')
    const dispatcher = { dispatchAction: async () => {} }
    return new NativeContext(pluginName, () => dispatcher as any) as any
  }

  async function activities(ticketId: number) {
    const { default: TicketActivity } = await import('../../src/models/ticket_activity.js')
    return TicketActivity.query().where('ticket_id', ticketId).orderBy('id')
  }

  test('ctx.tickets.create logs the opening, attaches the default SLA and announces it', async ({
    assert,
    cleanup,
  }) => {
    const config = getConfig() as any
    const previousSla = config.sla
    config.sla = { enabled: true }
    const { default: SlaPolicy } = await import('../../src/models/sla_policy.js')
    const policy = await SlaPolicy.create({
      name: `Plugin SLA ${Date.now()}`,
      description: null,
      departmentId: null,
      ticketType: null,
      isDefault: true,
      firstResponseHours: { low: 24, medium: 8, high: 4, urgent: 1, critical: 1 },
      resolutionHours: { low: 72, medium: 48, high: 24, urgent: 8, critical: 4 },
      businessHoursOnly: false,
      isActive: true,
    } as any)
    const { about, stop } = await listen(['ticket.created'])
    cleanup(async () => {
      stop()
      config.sla = previousSla
      await policy.delete()
    })
    const ctx = await context()
    const { actingAs } = await import('../../src/bridge/native_context.js')

    const created = await actingAs(TEST_USERS.agent, () =>
      ctx.tickets.create({ subject: 'From a plugin' })
    )
    await settle()

    const { default: Ticket } = await import('../../src/models/ticket.js')
    const ticket = await Ticket.findOrFail(created.id)
    const rows = await activities(ticket.id)
    assert.equal(ticket.slaPolicyId, policy.id)
    assert.deepEqual(
      rows.map((row) => row.type),
      ['status_changed']
    )
    assert.equal(Number(rows[0].causerId), TEST_USERS.agent.id)
    assert.deepEqual(about(ticket.id), ['ticket.created'])
  })

  test('ctx.tickets.create reaches a requested status as a status change', async ({
    assert,
    cleanup,
  }) => {
    const { about, stop } = await listen(['ticket.status_changed'])
    cleanup(stop)
    const ctx = await context()

    const created = await ctx.tickets.create({ subject: 'Waiting', status: 'waiting_on_customer' })
    await settle()

    assert.equal(created.status, 'waiting_on_customer')
    const rows = await activities(Number(created.id))
    assert.deepEqual(
      rows.map((row) => row.type),
      ['status_changed', 'status_changed']
    )
    assert.deepEqual(about(Number(created.id)), ['ticket.status_changed'])
  })

  test('ctx.tickets.update changes status, priority and department through the service', async ({
    assert,
    cleanup,
  }) => {
    const { default: Department } = await import('../../src/models/department.js')
    const department = await Department.create({
      name: `Plugin dept ${Date.now()}`,
      slug: `plugin-dept-${Date.now()}`,
      isActive: true,
    } as any)
    const ticket = await openTicket('Plugin update')
    const { about, stop } = await listen([
      'ticket.updated',
      'ticket.status_changed',
      'ticket.priority_changed',
      'ticket.department_changed',
    ])
    cleanup(stop)
    const ctx = await context()
    const { actingAs } = await import('../../src/bridge/native_context.js')

    await actingAs(TEST_USERS.agent, () =>
      ctx.tickets.update(ticket.id, {
        title: 'Renamed',
        status: 'in_progress',
        priority: 'urgent',
        department_id: department.id,
      })
    )
    await settle()

    await ticket.refresh()
    assert.equal(ticket.subject, 'Renamed')
    assert.equal(ticket.status, 'in_progress')
    assert.equal(ticket.priority, 'urgent')
    assert.equal(ticket.departmentId, department.id)
    const rows = await activities(ticket.id)
    assert.includeMembers(
      rows.map((row) => row.type),
      ['status_changed', 'priority_changed', 'department_changed']
    )
    assert.deepEqual([...new Set(rows.map((row) => Number(row.causerId)))], [TEST_USERS.agent.id])
    assert.sameMembers(about(ticket.id), [
      'ticket.updated',
      'ticket.status_changed',
      'ticket.priority_changed',
      'ticket.department_changed',
    ])
  })

  test('ctx.tickets.update refuses a status change the transitions do not allow', async ({
    assert,
  }) => {
    const ticket = await openTicket('Closed one', { status: 'closed' })
    const ctx = await context()

    await assert.rejects(
      () => ctx.tickets.update(ticket.id, { priority: 'high', status: 'in_progress' }),
      /Cannot transition/
    )
    await ticket.refresh()
    assert.equal(ticket.priority, 'low')
  })

  test('ctx.replies.create logs and announces replies and notes', async ({ assert, cleanup }) => {
    const ticket = await openTicket('Plugin replies')
    const { about, stop } = await listen(['reply.created', 'note.created'])
    cleanup(stop)
    const ctx = await context()
    const { actingAs } = await import('../../src/bridge/native_context.js')

    await actingAs(TEST_USERS.agent, () =>
      ctx.replies.create({ ticket_id: ticket.id, body: 'Synced' })
    )
    await ctx.replies.create({ ticket_id: ticket.id, body: 'Note', is_internal: true })
    await settle()

    const rows = await activities(ticket.id)
    assert.deepEqual(
      rows.map((row) => row.type),
      ['replied', 'note_added']
    )
    assert.equal(Number(rows[0].causerId), TEST_USERS.agent.id)
    assert.isNull(rows[1].causerId)
    assert.sameMembers(about(ticket.id), ['reply.created', 'note.created'])
  })

  test('a plugin write does not re-deliver the event it is handling', async ({
    assert,
    cleanup,
  }) => {
    const { on, stop } = await listen([])
    cleanup(stop)
    const ctx = await context()
    const marker = `loop-${Date.now()}`
    const calls: number[] = []
    // A plugin that opens a follow-up for every new ticket (only this
    // test's: other specs' deliveries may still be in flight).
    on('ticket.created', async (payload: any) => {
      if (!String(payload.subject).startsWith(marker)) return
      calls.push(payload.id)
      if (calls.length > 5) return
      await ctx.tickets.create({ subject: `${marker} follow-up for ${payload.id}` })
    })

    const first = await ctx.tickets.create({ subject: `${marker} origin` })
    await settle(800)

    assert.deepEqual(calls, [first.id])
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const ours = await Ticket.query().whereLike('subject', `${marker}%`)
    assert.lengthOf(ours, 2)
  })

  test('other events a plugin write raises are still delivered', async ({ assert, cleanup }) => {
    const { about, on, stop } = await listen(['reply.created'])
    cleanup(stop)
    const ctx = await context()
    const marker = `thanked-${Date.now()}`
    on('ticket.created', async (payload: any) => {
      if (!String(payload.subject).startsWith(marker)) return
      await ctx.replies.create({ ticket_id: payload.id, body: 'Thanks' })
    })

    const first = await ctx.tickets.create({ subject: `${marker} origin` })
    await settle(800)

    assert.deepEqual(about(first.id), ['reply.created'])
  })
})
