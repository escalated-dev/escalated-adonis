import { test } from '@japa/runner'
import { createRequire } from 'node:module'
import { DateTime } from 'luxon'
import { InertiaClient, testApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'
import { clearAgentInboxCache } from '../../src/services/agent_inbox.js'

/*
 * The agent panel's optional `inbox` and `queue` props, and the list filters
 * its rail, views and stat strip link to (shared frontend docs/agent-panel.md),
 * as escalated-laravel sends them.
 *
 * Every number here must be what the agent would get by opening the list it
 * labels, so the tests check counts against the list and against visibility.
 */

const AGENT = TEST_USERS.agent
// Another member of staff: assignee and saved-view owner who is not the agent.
const OTHER = TEST_USERS.admin
const INDEX = '/support/agent/tickets'
const BUILT_IN_VIEW_IDS = [
  'urgent',
  'sla_at_risk',
  'waiting_on_me',
  'waiting_on_customer',
  'recently_updated',
]
// The shared frontend's current manifest (escalated-dev/escalated pages.json).
// The published package does not declare the agent panel props yet.
const MANIFEST = createRequire(import.meta.url)('./fixtures/escalated-pages.json')

let seq = 0

async function models() {
  const { default: Ticket } = await import('../../src/models/ticket.js')
  const { default: Reply } = await import('../../src/models/reply.js')
  const { default: SavedView } = await import('../../src/models/saved_view.js')
  return { Ticket, Reply, SavedView }
}

async function inboxTicket(attributes: Record<string, any> = {}) {
  const { Ticket } = await models()
  seq += 1
  return Ticket.create({
    requesterType: 'User',
    requesterId: TEST_USERS.customer.id,
    reference: `INBOX-${Date.now()}-${seq}`,
    subject: `Inbox ${seq}`,
    description: 'Details',
    status: 'open' as const,
    priority: 'low' as const,
    ticketType: 'question',
    channel: 'web',
    slaFirstResponseBreached: false,
    slaResolutionBreached: false,
    ...attributes,
  } as any)
}

async function backdate(ticket: any, column: string, time: DateTime) {
  const { Ticket } = await models()
  const query: any = Ticket.query()
  const format = query.client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
  await Ticket.query()
    .where('id', ticket.id)
    .update({ [column]: time.toFormat(format) })
}

async function clean() {
  const { Ticket, Reply, SavedView } = await models()
  await Reply.query().delete()
  await SavedView.query().delete()
  await Ticket.query().delete()
  clearAgentInboxCache()
}

function ids(response: any): number[] {
  return response.body.props.tickets.data.map((ticket: any) => ticket.id)
}

function total(response: any): number {
  return Number(response.body.props.tickets.meta.total)
}

test.group('Agent inbox props', (group) => {
  let client: InertiaClient
  let otherClient: InertiaClient
  let original: any

  async function visit(path: string, as: InertiaClient = client) {
    const response = await as.visit('GET', path)
    if (response.status !== 200) {
      throw new Error(`GET ${path}: ${response.status} ${JSON.stringify(response.body)}`)
    }
    return response
  }

  async function propsOf(path: string, as: InertiaClient = client) {
    const response = await visit(path, as)
    return response.body.props
  }

  group.setup(async () => {
    const running = await testApp()
    client = new InertiaClient(running.baseUrl, { user: AGENT })
    otherClient = new InertiaClient(running.baseUrl, { user: OTHER })
    original = getConfig().agentInbox
    getConfig().agentInbox = { cacheSeconds: 0 }
    await clean()
  })
  group.teardown(async () => {
    getConfig().agentInbox = original
    await clean()
  })
  group.each.teardown(async () => {
    getConfig().agentInbox = { cacheSeconds: 0 }
    getConfig().mode = 'self-hosted'
    await clean()
  })
  group.each.timeout(60000)

  test('sends inbox counts, built-in views, stats and the queue on the ticket list', async ({
    assert,
  }) => {
    await inboxTicket({ assignedTo: AGENT.id, priority: 'urgent' })
    await inboxTicket({ assignedTo: AGENT.id, status: 'waiting_on_customer' })
    await inboxTicket({ assignedTo: AGENT.id, status: 'resolved', resolvedAt: DateTime.now() })
    await inboxTicket({
      assignedTo: AGENT.id,
      status: 'resolved',
      resolvedAt: DateTime.now().minus({ days: 2 }),
    })
    await inboxTicket({ assignedTo: AGENT.id, snoozedUntil: DateTime.now().plus({ days: 1 }) })
    await inboxTicket()
    await inboxTicket({ status: 'closed' })
    await inboxTicket({ assignedTo: OTHER.id })

    const response = await visit(INDEX)
    assert.equal(response.body.component, 'Escalated/Agent/TicketIndex')

    const inbox = response.body.props.inbox
    assert.deepEqual(Object.keys(inbox), ['counts', 'unread', 'views', 'stats'])
    // Unresolved, unsnoozed tickets in each queue.
    assert.deepEqual(inbox.counts, { mine: 2, unassigned: 1, all: 4 })
    assert.deepEqual(
      inbox.views.map((view: any) => view.id),
      BUILT_IN_VIEW_IDS
    )
    assert.deepEqual(Object.keys(inbox.views[0]), ['id', 'name', 'count', 'filters'])
    assert.deepEqual(inbox.views[0], {
      id: 'urgent',
      name: 'Urgent',
      count: 1,
      filters: { priority: 'urgent', open: 1 },
    })
    assert.deepEqual(Object.keys(inbox.stats), ['open', 'urgent', 'sla_at_risk', 'resolved_today'])
    // The "all" queue: three tickets with status open, one urgent, one resolved today.
    assert.deepEqual(inbox.stats, { open: 3, urgent: 1, sla_at_risk: 0, resolved_today: 1 })
    assert.deepEqual(response.body.props.queue, { key: 'all', title: 'All tickets' })

    const views = Object.fromEntries(inbox.views.map((view: any) => [view.id, view]))
    assert.equal(views.waiting_on_customer.count, 1)
    assert.deepEqual(views.waiting_on_customer.filters, {
      assigned_to: AGENT.id,
      status: 'waiting_on_customer',
    })
    assert.deepEqual(views.waiting_on_me.filters, {
      assigned_to: AGENT.id,
      status: 'waiting_on_agent',
    })
    assert.deepEqual(views.sla_at_risk.filters, { sla_at_risk: 1 })
    assert.deepEqual(views.recently_updated.filters, {
      open: 1,
      updated_within_hours: 24,
      sort_by: 'updated_at',
    })
    assert.equal(views.recently_updated.count, 4)
  })

  const queues: Array<[string, string, string, string, number[]]> = [
    ['mine', '?assigned_to={me}', 'mine', 'My inbox', [1, 1, 0, 1]],
    ['mine, by alias', '?assigned=me', 'mine', 'My inbox', [1, 1, 0, 1]],
    [
      'mine with a stat tile on',
      '?assigned_to={me}&priority=urgent',
      'mine',
      'My inbox',
      [1, 1, 0, 1],
    ],
    ['unassigned', '?unassigned=1', 'unassigned', 'Unassigned', [2, 1, 0, 1]],
    ['all', '', 'all', 'All tickets', [3, 2, 0, 2]],
    [
      'a built-in view by its filters',
      '?priority=urgent&open=1',
      'view:urgent',
      'Urgent',
      [2, 2, 0, 0],
    ],
    ['a built-in view by id', '?view=urgent', 'view:urgent', 'Urgent', [2, 2, 0, 0]],
  ]
  for (const [label, query, key, title, stats] of queues) {
    test(`names and scopes the queue from the list query: ${label}`, async ({ assert }) => {
      await inboxTicket({ assignedTo: AGENT.id, priority: 'urgent' })
      await inboxTicket({ assignedTo: AGENT.id, status: 'resolved', resolvedAt: DateTime.now() })
      await inboxTicket()
      await inboxTicket({ status: 'resolved', resolvedAt: DateTime.now() })
      await inboxTicket({ priority: 'urgent' })

      const response = await visit(INDEX + query.replace('{me}', String(AGENT.id)))

      assert.deepEqual(response.body.props.queue, { key, title })
      const [open, urgent, slaAtRisk, resolvedToday] = stats
      assert.deepEqual(response.body.props.inbox.stats, {
        open,
        urgent,
        sla_at_risk: slaAtRisk,
        resolved_today: resolvedToday,
      })
    })
  }

  test("lists the agent's own and shared saved views with counts, but not others' private views", async ({
    assert,
  }) => {
    const { SavedView } = await models()
    const mine = await SavedView.create({
      name: 'High priority',
      slug: 'high-priority',
      userId: AGENT.id,
      filters: { priority: 'high' },
      order: 1,
    } as any)
    const shared = await SavedView.create({
      name: 'Waiting',
      slug: 'waiting',
      userId: OTHER.id,
      isShared: true,
      filters: { status: 'waiting_on_agent' },
      order: 2,
    } as any)
    await SavedView.create({
      name: 'Private',
      slug: 'private',
      userId: OTHER.id,
      isShared: false,
      filters: { priority: 'low' },
      order: 0,
    } as any)

    await inboxTicket({ priority: 'high' })
    await inboxTicket({ priority: 'high' })
    await inboxTicket({ priority: 'high', status: 'closed' })
    await inboxTicket({ status: 'waiting_on_agent' })

    const page = await propsOf(INDEX)
    const views = page.inbox.views
    const saved = views.filter((view: any) => !BUILT_IN_VIEW_IDS.includes(view.id))

    assert.deepEqual(saved, [
      { id: mine.id, name: 'High priority', count: 2, filters: { priority: 'high' } },
      { id: shared.id, name: 'Waiting', count: 1, filters: { status: 'waiting_on_agent' } },
    ])
  })

  for (const by of ['id', 'filters']) {
    test(`selects a saved view as the queue, by ${by}, and filters the list with it`, async ({
      assert,
    }) => {
      const { SavedView } = await models()
      const view = await SavedView.create({
        name: 'High priority',
        slug: 'high-priority',
        userId: AGENT.id,
        filters: { priority: 'high' },
        order: 1,
      } as any)
      const high = await inboxTicket({ priority: 'high' })
      await inboxTicket({ priority: 'low' })

      const response = await visit(INDEX + (by === 'id' ? `?view=${view.id}` : '?priority=high'))

      assert.deepEqual(response.body.props.queue, {
        key: `view:${view.id}`,
        title: 'High priority',
      })
      assert.deepEqual(ids(response), [high.id])
    })
  }

  test("does not let an agent select another agent's private view", async ({ assert }) => {
    const { SavedView } = await models()
    const hidden = await SavedView.create({
      name: 'Private',
      slug: 'private',
      userId: OTHER.id,
      isShared: false,
      filters: { priority: 'high' },
      order: 1,
    } as any)
    await inboxTicket({ priority: 'high' })
    await inboxTicket({ priority: 'low' })

    const response = await visit(`${INDEX}?view=${hidden.id}`)

    assert.deepEqual(response.body.props.queue, { key: 'all', title: 'All tickets' })
    assert.equal(total(response), 2)
  })

  test('gives every built-in view the count its own list shows', async ({ assert }) => {
    await inboxTicket({ assignedTo: AGENT.id, priority: 'urgent' })
    await inboxTicket({ priority: 'urgent', status: 'closed' })
    await inboxTicket({ assignedTo: AGENT.id, status: 'waiting_on_agent' })
    await inboxTicket({ assignedTo: AGENT.id, status: 'waiting_on_customer' })
    await inboxTicket({ slaFirstResponseBreached: true })
    await inboxTicket({ resolutionDueAt: DateTime.now().plus({ minutes: 30 }) })
    const stale = await inboxTicket()
    await backdate(stale, 'updated_at', DateTime.now().minus({ days: 3 }))

    const page = await propsOf(INDEX)
    const views = page.inbox.views

    for (const view of views) {
      const query = new URLSearchParams(
        Object.entries(view.filters).map(([k, v]) => [k, String(v)])
      ).toString()
      const listing = await visit(`${INDEX}?${query}`)
      const listed = total(listing)
      assert.equal(
        view.count,
        listed,
        `view ${view.id} counts ${view.count} but its list shows ${listed}`
      )
    }

    assert.deepEqual(Object.fromEntries(views.map((view: any) => [view.id, view.count])), {
      urgent: 1,
      sla_at_risk: 2,
      waiting_on_me: 1,
      waiting_on_customer: 1,
      recently_updated: 5,
    })
  })

  test('counts only tickets the agent may see', async ({ assert, cleanup }) => {
    const { default: Department } = await import('../../src/models/department.js')
    const support = await Department.create({
      name: 'Inbox support',
      slug: `inbox-support-${Date.now()}`,
      isActive: true,
    })
    const billing = await Department.create({
      name: 'Inbox billing',
      slug: `inbox-billing-${Date.now()}`,
      isActive: true,
    })
    await support.attachAgent(AGENT.id)
    const previous = (getConfig() as any).visibility
    ;(getConfig() as any).visibility = 'department'
    cleanup(async () => {
      ;(getConfig() as any).visibility = previous
    })

    await inboxTicket({ departmentId: support.id, assignedTo: AGENT.id, priority: 'urgent' })
    await inboxTicket({ departmentId: support.id })
    await inboxTicket({ departmentId: billing.id })
    await inboxTicket({ departmentId: billing.id, priority: 'urgent' })
    await inboxTicket({ departmentId: billing.id, status: 'resolved', resolvedAt: DateTime.now() })

    const page = await propsOf(INDEX)
    const inbox = page.inbox

    assert.deepEqual(inbox.counts, { mine: 1, unassigned: 1, all: 2 })
    assert.deepEqual(inbox.stats, { open: 2, urgent: 1, sla_at_risk: 0, resolved_today: 0 })
    assert.equal(inbox.views.find((view: any) => view.id === 'urgent').count, 1)
  })

  test('filters the list to tickets whose SLA is breached or due within the hour', async ({
    assert,
  }) => {
    const now = DateTime.now()
    const breached = await inboxTicket({ slaResolutionBreached: true })
    const responseDue = await inboxTicket({ firstResponseDueAt: now.plus({ minutes: 20 }) })
    const resolutionDue = await inboxTicket({ resolutionDueAt: now.plus({ minutes: 50 }) })
    await inboxTicket({
      firstResponseDueAt: now.plus({ minutes: 20 }),
      firstResponseAt: now.minus({ minutes: 1 }),
    })
    await inboxTicket({ resolutionDueAt: now.plus({ hours: 3 }) })
    await inboxTicket({ slaResolutionBreached: true, status: 'resolved', resolvedAt: now })
    await inboxTicket()

    const response = await visit(`${INDEX}?sla_at_risk=1`)

    assert.deepEqual(
      ids(response).sort((a, b) => a - b),
      [breached.id, responseDue.id, resolutionDue.id].sort((a, b) => a - b)
    )
    assert.equal(response.body.props.inbox.stats.sla_at_risk, 3)
  })

  test('filters the list to tickets resolved today', async ({ assert }) => {
    const start = DateTime.now().startOf('day')
    const today = await inboxTicket({ status: 'resolved', resolvedAt: start.plus({ minutes: 1 }) })
    await inboxTicket({ status: 'resolved', resolvedAt: start.minus({ days: 1 }) })
    await inboxTicket()

    const response = await visit(`${INDEX}?status=resolved&resolved_today=1`)

    assert.deepEqual(ids(response), [today.id])
  })

  test('filters the list to tickets updated within the given hours', async ({ assert }) => {
    const fresh = await inboxTicket()
    const stale = await inboxTicket()
    await backdate(stale, 'updated_at', DateTime.now().minus({ days: 2 }))

    const response = await visit(`${INDEX}?updated_within_hours=24`)
    assert.deepEqual(ids(response), [fresh.id])
  })

  test('filters the list to unresolved tickets with open=1', async ({ assert }) => {
    const open = await inboxTicket()
    await inboxTicket({ status: 'resolved', resolvedAt: DateTime.now() })
    await inboxTicket({ status: 'closed' })

    const response = await visit(`${INDEX}?open=1`)
    assert.deepEqual(ids(response), [open.id])
  })

  test('filters the list to the agent with assigned=me', async ({ assert }) => {
    const mine = await inboxTicket({ assignedTo: AGENT.id })
    await inboxTicket({ assignedTo: OTHER.id })
    await inboxTicket()

    const response = await visit(`${INDEX}?assigned=me`)
    assert.deepEqual(ids(response), [mine.id])
  })

  const malformed: Array<Record<string, string>> = [
    { sla_at_risk: 'soon' },
    { resolved_today: 'maybe' },
    { open: 'perhaps' },
    { updated_within_hours: '0' },
    { updated_within_hours: 'a day' },
    { updated_within_hours: '9000' },
  ]
  for (const query of malformed) {
    test(`sends malformed values for the new filters back with errors: ${JSON.stringify(query)}`, async ({
      assert,
    }) => {
      // escalated-laravel's $request->validate(): a redirect back with the
      // errors flashed for the next page, never a raw 422 (which the Inertia
      // client shows as an error modal).
      const from = `${INDEX}?assigned=me`
      const response = await client.visit('GET', `${INDEX}?${new URLSearchParams(query)}`, {
        referer: from,
      })

      assert.equal(response.status, 302)
      assert.equal(response.location, from)
      const next = await client.visit('GET', from)
      assert.deepEqual(Object.keys(next.body.flash.errors), Object.keys(query))
      for (const message of Object.values(next.body.flash.errors)) assert.isString(message)
    })

    test(`answers a JSON client's malformed filter with a 422: ${JSON.stringify(query)}`, async ({
      assert,
    }) => {
      const response = await client.visit('GET', `${INDEX}?${new URLSearchParams(query)}`, {
        headers: { 'X-Inertia': '', 'X-Requested-With': '', 'Accept': 'application/json' },
      })

      assert.equal(response.status, 422)
      assert.deepEqual(Object.keys(response.body.errors), Object.keys(query))
      assert.isString(response.body.message)
    })
  }

  test('sends a malformed filter with no referer back to the list', async ({ assert }) => {
    const response = await client.visit('GET', `${INDEX}?sla_at_risk=soon`)

    assert.equal(response.status, 302)
    assert.equal(response.location, INDEX)
  })

  test('previews the latest customer-visible message, never an internal note', async ({
    assert,
  }) => {
    const { Reply } = await models()
    const ticket = await inboxTicket()
    await Reply.create({
      ticketId: ticket.id,
      body: 'Customer-visible answer',
      authorType: 'User',
      authorId: AGENT.id,
      isInternalNote: false,
      createdAt: DateTime.now().minus({ minutes: 5 }),
    } as any)
    await Reply.create({
      ticketId: ticket.id,
      body: 'Secret internal note',
      authorType: 'User',
      authorId: AGENT.id,
      isInternalNote: true,
      createdAt: DateTime.now(),
    } as any)

    const page = await propsOf(INDEX)
    const row = page.tickets.data[0]

    assert.equal(row.latest_reply.body, 'Customer-visible answer')
    assert.isNotNull(row.last_reply_at)
    // The new ticket is customer activity; the agent's own replies are not.
    assert.isTrue(row.is_unread)
    assert.isFalse(row.requester_online)
  })

  test('sends inbox and the queue the agent last opened on the ticket page', async ({ assert }) => {
    const ticket = await inboxTicket({ assignedTo: AGENT.id })
    await inboxTicket()
    const show = `${INDEX}/${ticket.id}`

    let response = await visit(show)
    assert.equal(response.body.component, 'Escalated/Agent/TicketShow')
    assert.deepEqual(response.body.props.queue, { key: 'all', title: 'All tickets' })
    assert.deepEqual(response.body.props.inbox.counts, { mine: 1, unassigned: 1, all: 2 })
    assert.deepEqual(Object.keys(response.body.props.inbox), ['counts', 'unread', 'views', 'stats'])

    await visit(`${INDEX}?assigned_to=${AGENT.id}`)

    response = await visit(show)
    assert.deepEqual(response.body.props.queue, { key: 'mine', title: 'My inbox' })
    assert.deepEqual(response.body.props.inbox.stats, {
      open: 1,
      urgent: 0,
      sla_at_risk: 0,
      resolved_today: 0,
    })
    // Back to All tickets for the specs that follow.
    await visit(INDEX)
  })

  test('caches the inbox per agent for the configured seconds', async ({ assert, cleanup }) => {
    getConfig().agentInbox = { cacheSeconds: 30 }
    const realNow = Date.now
    cleanup(() => {
      Date.now = realNow
    })

    await inboxTicket({ assignedTo: AGENT.id })
    const first = await propsOf(INDEX)
    assert.equal(first.inbox.counts.mine, 1)

    await inboxTicket({ assignedTo: AGENT.id })
    await inboxTicket({ assignedTo: OTHER.id })

    const cached = await propsOf(INDEX)
    assert.equal(cached.inbox.counts.mine, 1)
    const other = await propsOf(INDEX, otherClient)
    assert.equal(other.inbox.counts.mine, 1)

    const later = realNow() + 31_000
    Date.now = () => later
    const expired = await propsOf(INDEX)
    assert.equal(expired.inbox.counts.mine, 2)
  })

  test('sends no inbox in cloud mode, where tickets are not stored locally', async ({ assert }) => {
    const ticket = await inboxTicket()
    getConfig().mode = 'cloud'

    const response = await visit(`${INDEX}/${ticket.id}`)

    assert.notProperty(response.body.props, 'inbox')
    assert.deepEqual(response.body.props.queue, { key: 'all', title: 'All tickets' })
  })

  for (const component of ['Escalated/Agent/TicketIndex', 'Escalated/Agent/TicketShow']) {
    test(`sends ${component} every prop it declares`, async ({ assert }) => {
      const ticket = await inboxTicket()
      const response = await visit(component.endsWith('Index') ? INDEX : `${INDEX}/${ticket.id}`)

      assert.equal(response.body.component, component)
      const declared: string[] = MANIFEST.props[component].props
      assert.deepEqual(
        declared.filter((prop) => !(prop in response.body.props)),
        []
      )
      assert.includeMembers(declared, ['inbox', 'queue'])
    })
  }
})
