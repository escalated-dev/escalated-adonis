import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import {
  withTicketAccess,
  withoutTicketAccess,
  validateTicketAccess,
} from '../../src/support/ticket_access.js'
import { getConfig } from '../../src/helpers/config.js'

test.group('Configurable ticket access', (group) => {
  let running: TestApp
  let visible: any
  let hidden: any
  let client: InertiaClient
  let original: any

  group.setup(async () => {
    running = await testApp()
    const { default: Department } = await import('../../src/models/department.js')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const own = await Department.create({ name: 'Access own', slug: 'access-own', isActive: true })
    const other = await Department.create({
      name: 'Access other',
      slug: 'access-other',
      isActive: true,
    })
    await own.attachAgent(TEST_USERS.agent.id)
    const attrs = {
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject: 'Visibility',
      description: 'Details',
      status: 'open' as const,
      priority: 'low' as const,
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    }
    visible = await Ticket.create({ ...attrs, reference: 'ACCESS-VISIBLE', departmentId: own.id })
    hidden = await Ticket.create({
      ...attrs,
      reference: 'ACCESS-HIDDEN',
      departmentId: other.id,
      assignedTo: TEST_USERS.agent.id,
      guestToken: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    original = (getConfig() as any).visibility
    ;(getConfig() as any).visibility = 'department'
  })
  group.teardown(async () => {
    ;(getConfig() as any).visibility = original
    const { default: Ticket } = await import('../../src/models/ticket.js')
    await Ticket.query().whereIn('id', [visible.id, hidden.id]).delete()
  })
  group.each.teardown(async () => {
    getConfig().visibility = 'department'
    getConfig().accounts = undefined
    getConfig().targetedSlas = false
    await visible.merge({ accountType: null, accountId: null }).save()
    await hidden.merge({ accountType: null, accountId: null }).save()
  })
  group.each.timeout(30000)

  test('scopes agent lists', async ({ assert }) => {
    const response = await client.visit('GET', '/support/agent/tickets')
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.deepEqual(
      response.body.props.tickets.data.map((ticket: any) => ticket.id),
      [visible.id]
    )
  })

  test('scopes search and direct numeric detail lookup', async ({ assert }) => {
    const response = await client.visit('GET', '/support/agent/tickets?search=ACCESS-HIDDEN')
    assert.deepEqual(response.body.props.tickets.data, [])
    const searchResponse = await client.visit('GET', `/support/agent/tickets/${hidden.id}`)
    assert.equal(searchResponse.status, 404)
  })

  test('scopes mixed bulk changes', async ({ assert }) => {
    const response = await client.visit('POST', '/support/agent/tickets/bulk', {
      data: { ticket_ids: [visible.id, hidden.id], action: 'priority', value: 'high' },
    })
    assert.equal(response.status, 302, JSON.stringify(response.body))
    const hiddenTicket = await hidden.refresh()
    assert.equal(hiddenTicket.priority, 'low')
    const visibleTicket = await visible.refresh()
    assert.equal(visibleTicket.priority, 'high')
  })

  test('scopes token-owner API queries', async ({ assert }) => {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(TEST_USERS.agent, 'Access', ['agent'])
    const api = new InertiaClient(running.baseUrl)
    const response = await api.visit('GET', '/support/api/v1/tickets', {
      headers: { Authorization: `Bearer ${plainTextToken}` },
    })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.deepEqual(
      response.body.data.map((ticket: any) => ticket.id),
      [visible.id]
    )
    const hiddenApiResponse = await api.visit('GET', `/support/api/v1/tickets/${hidden.id}`, {
      headers: { Authorization: `Bearer ${plainTextToken}` },
    })
    assert.equal(hiddenApiResponse.status, 404)
  })

  test('scopes the widget even when an agent knows a valid guest token', async ({
    assert,
    cleanup,
  }) => {
    // A permanent guest token, as earlier releases issued (docs/guest-access.md).
    const config = getConfig() as any
    const previousGuestAccess = config.guestAccess
    config.guestAccess = { ...previousGuestAccess, legacyTokens: true }
    cleanup(() => {
      config.guestAccess = previousGuestAccess
    })
    const agentWidgetResponse = await client.visit(
      'GET',
      '/support/widget/tickets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
    assert.equal(agentWidgetResponse.status, 404)
    const guest = new InertiaClient(running.baseUrl)
    const guestWidgetResponse = await guest.visit(
      'GET',
      '/support/widget/tickets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
    assert.equal(guestWidgetResponse.status, 200)
  })

  test('scopes raw reports and cloned counts, preserving caller OR groups', async ({ assert }) => {
    await withTicketAccess(TEST_USERS.agent, async () => {
      const query = running.db
        .from('escalated_tickets')
        .where('id', visible.id)
        .orWhere('id', hidden.id)
      const firstRead = await query.clone().select('id')
      assert.deepEqual(
        firstRead.map((row: any) => row.id),
        [visible.id]
      )
      const count = await query.clone().count('* as count').first()
      assert.equal(Number(count.count), 1)
      const secondRead = await query.clone().select('id')
      assert.deepEqual(
        secondRead.map((row: any) => row.id),
        [visible.id]
      )
      const { default: Reports } = await import('../../src/controllers/admin_reports_controller.js')
      let props: any
      await new Reports().handle({
        request: { input: (_key: string, fallback: any) => fallback },
        inertia: {
          render: (_component: string, data: any) => {
            props = data
          },
        },
      } as any)
      assert.equal(props.total_tickets, 1)
      assert.equal(props.by_status.open, 1)
    })
  })

  test('denies reply, assign, close and update on hidden tickets', async ({ assert }) => {
    for (const [method, action, data] of [
      ['POST', '/reply', { body: 'Hidden reply' }],
      ['POST', '/assign', { agent_id: TEST_USERS.agent.id }],
      ['POST', '/status', { status: 'closed' }],
      ['PUT', '', { subject: 'Changed' }],
    ] as const) {
      const mutationResponse = await client.visit(
        method,
        `/support/agent/tickets/${hidden.id}${action}`,
        { data }
      )
      assert.equal(mutationResponse.status, 404)
    }
    const { default: Service } = await import('../../src/services/ticket_service.js')
    await assert.rejects(() =>
      withTicketAccess(TEST_USERS.agent, () =>
        new Service().reply(hidden, TEST_USERS.agent, 'Loaded earlier')
      )
    )
  })

  test('preserves admins, default-off access and concurrent background work', async ({
    assert,
  }) => {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const ids = () => Ticket.query().whereIn('id', [visible.id, hidden.id]).orderBy('id')
    const [agent, admin, background] = await Promise.all([
      withTicketAccess(TEST_USERS.agent, ids),
      withTicketAccess(TEST_USERS.admin, ids),
      ids(),
    ])
    assert.lengthOf(agent, 1)
    assert.lengthOf(admin, 2)
    assert.lengthOf(background, 2)
    await withTicketAccess(TEST_USERS.agent, async () =>
      assert.lengthOf(await withoutTicketAccess(ids), 2)
    )
    getConfig().visibility = 'all'
    assert.lengthOf(await withTicketAccess(TEST_USERS.agent, ids), 2)
  })

  test('scopes child rows and both ends of ticket links', async ({ assert }) => {
    const { default: Reply } = await import('../../src/models/reply.js')
    const visibleReply = await Reply.create({
      ticketId: visible.id,
      body: 'Allowed',
      isInternalNote: false,
    })
    const hiddenReply = await Reply.create({
      ticketId: hidden.id,
      body: 'Hidden',
      isInternalNote: false,
    })
    await running.db
      .table('escalated_ticket_links')
      .insert({ parent_ticket_id: visible.id, child_ticket_id: hidden.id, link_type: 'related' })
    await withTicketAccess(TEST_USERS.agent, async () => {
      assert.isNull(await Reply.find(hiddenReply.id))
      const visibleReplyRecord = await Reply.find(visibleReply.id)
      assert.equal(visibleReplyRecord?.id, visibleReply.id)
      assert.deepEqual(await running.db.from('escalated_ticket_links'), [])
    })
  })

  test('intersects account and department identity with exact type and id matching', async ({
    assert,
  }) => {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    await visible.merge({ accountType: 'Company', accountId: 'ACME' }).save()
    await hidden.merge({ accountType: 'Company', accountId: 'ACME' }).save()
    getConfig().accounts = {
      enabled: true,
      scopeAgents: true,
      resolver: () => ({ type: 'Company', id: 'ACME' }),
    }
    const matchingTickets = await withTicketAccess(TEST_USERS.agent, () => Ticket.all())
    assert.deepEqual(
      matchingTickets.map((row) => row.id),
      [visible.id]
    )
    getConfig().accounts!.resolver = () => ({ type: 'Company', id: 'acme' })
    assert.isEmpty(await withTicketAccess(TEST_USERS.agent, () => Ticket.all()))
    getConfig().accounts!.resolver = () => null
    assert.isEmpty(await withTicketAccess(TEST_USERS.agent, () => Ticket.all()))
    const admin = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    const adminResponse = await admin.visit('GET', `/support/admin/tickets/${hidden.id}`)
    assert.equal(adminResponse.status, 200)
  })

  test('resolves account from requester and subject without trusting request account fields', async ({
    assert,
  }) => {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    getConfig().accounts = {
      enabled: true,
      resolver: (reference) => ({
        type: 'Company',
        id: reference.kind === 'subject' ? 'subject' : 'requester',
      }),
    }
    const ticket = await Ticket.create({
      ...visible.$attributes,
      id: undefined,
      reference: 'ACCESS-RESOLVER',
      accountType: null,
      accountId: null,
    })
    try {
      assert.equal(ticket.accountId, 'requester')
      await ticket.merge({ accountType: null, accountId: null }).save()
      await ticket.attachSubject('Project', 42)
      assert.equal(ticket.accountId, 'subject')
      await ticket.attachSubject('Project', 43)
      assert.equal(ticket.accountId, 'subject')
    } finally {
      await ticket.delete()
    }
  })

  test('subject failures do not change the ticket account', async ({ assert }) => {
    getConfig().accounts = { enabled: true, resolver: () => ({ type: 'Company', id: 'atomic' }) }
    // Force a real constraint failure after resolution, before the account can be persisted.
    await assert.rejects(() => visible.attachSubject('Project', 44, 'owner', null as any))
    await visible.refresh()
    assert.isNull(visible.accountId)
  })

  test('routes compound account and ticket type conditions in all engines', async ({ assert }) => {
    const { default: Workflow } = await import('../../src/services/workflow_engine.js')
    const { default: Automation } = await import('../../src/services/automation_runner.js')
    const { default: Escalation } = await import('../../src/services/escalation_service.js')
    await visible.merge({ accountType: 'Company', accountId: 'ACME' }).save()
    const conditions = [
      { field: 'ticket_type', value: 'question', operator: 'equals' },
      { field: 'account', value: { type: 'Company', id: 'ACME' }, operator: 'equals' },
    ]
    assert.isTrue(new Workflow().evaluateConditions({ all: conditions }, visible))
    for (const engine of [new Automation(), new Escalation()]) {
      const matches = await (engine as any).findMatchingTickets({ conditions })
      assert.deepEqual(
        matches.map((row: any) => row.id),
        [visible.id]
      )
    }
    conditions[1].value = { type: 'Company', id: 'acme' } as any
    assert.isFalse(new Workflow().evaluateConditions({ all: conditions }, visible))
    assert.isEmpty(await (new Automation() as any).findMatchingTickets({ conditions }))
  })

  test('selects the most specific SLA and retains its creation-based clock on moves', async ({
    assert,
  }) => {
    const { default: Policy } = await import('../../src/models/sla_policy.js')
    const { default: Sla } = await import('../../src/services/sla_service.js')
    const defaults = {
      isActive: true,
      businessHoursOnly: false,
      firstResponseHours: { high: 1, low: 1 },
      resolutionHours: { high: 4, low: 4 },
    }
    const baseline = await Policy.create({ ...defaults, name: 'Access default', isDefault: true })
    const targeted = await Policy.create({
      ...defaults,
      name: 'Access target',
      isDefault: false,
      departmentId: visible.departmentId,
      ticketType: visible.ticketType,
    })
    const department = visible.departmentId
    try {
      getConfig().targetedSlas = true
      await new Sla().attachDefaultPolicy(visible)
      assert.equal(visible.slaPolicyId, targeted.id)
      assert.equal(
        visible.firstResponseDueAt?.toMillis(),
        visible.createdAt.plus({ hours: 1 }).toMillis()
      )
      const due = visible.firstResponseDueAt!.toMillis()
      await visible.merge({ departmentId: hidden.departmentId }).save()
      assert.equal(visible.slaPolicyId, targeted.id)
      assert.equal(visible.firstResponseDueAt!.toMillis(), due)
      await new Sla().attachDefaultPolicy(visible)
      assert.equal(visible.slaPolicyId, baseline.id)
    } finally {
      await visible.merge({ departmentId: department, slaPolicyId: null }).save()
      await targeted.delete()
      await baseline.delete()
    }
  })

  test('filters assignment and follower notifications using current membership', async ({
    assert,
  }) => {
    const { default: Assignment } = await import('../../src/services/assignment_service.js')
    await assert.rejects(() => new Assignment().assign(hidden, TEST_USERS.agent.id))
    await hidden.follow(TEST_USERS.agent.id)
    await hidden.follow(TEST_USERS.admin.id)
    assert.deepEqual(await hidden.followerUserIds(), [TEST_USERS.admin.id])
  })

  test('guards live delivery after access is revoked', async ({ assert }) => {
    const { default: Broadcast } = await import('../../src/services/broadcast_service.js')
    const { default: Department } = await import('../../src/models/department.js')
    const department = await Department.findOrFail(visible.departmentId)
    let deliveries = 0
    let transportCalls = 0
    const broadcast = new Broadcast(
      {
        enabled: true,
        deliverAuthorized: async (_payload, canReceive) => {
          if (await canReceive(TEST_USERS.agent.id)) deliveries++
        },
      },
      () => {
        transportCalls++
      }
    )
    await broadcast.broadcastTicketUpdated(visible)
    try {
      await department.detachAgent(TEST_USERS.agent.id)
      await broadcast.broadcastTicketUpdated(visible)
      assert.equal(deliveries, 1)
      assert.equal(transportCalls, 0)
    } finally {
      await department.attachAgent(TEST_USERS.agent.id)
    }
  })

  test('rejects account visibility without its resolver', ({ assert }) => {
    getConfig().accounts = { scopeAgents: true }
    assert.throws(() => validateTicketAccess(), 'Account visibility requires')
  })
})
