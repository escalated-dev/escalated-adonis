import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { InertiaClient, testApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'
import { clearAgentInboxCache } from '../../src/services/agent_inbox.js'

/*
 * The agent panel's data (ADR 2026-11-05-agent-panel-data): the agent's own
 * status, knowledge-base search, per-agent unread markers, customer presence
 * and the notifications feed, through the real routes.
 */

const AGENT = TEST_USERS.agent
const ADMIN = TEST_USERS.admin
const CUSTOMER = TEST_USERS.customer
const INDEX = '/support/agent/tickets'
const JSON_HEADERS = { Accept: 'application/json' }

let seq = 0

async function models() {
  const { default: Ticket } = await import('../../src/models/ticket.js')
  const { default: Reply } = await import('../../src/models/reply.js')
  const { default: TicketRead } = await import('../../src/models/ticket_read.js')
  const { default: CustomerPresence } = await import('../../src/models/customer_presence.js')
  const { default: AgentNotification } = await import('../../src/models/agent_notification.js')
  const { default: AgentProfile } = await import('../../src/models/agent_profile.js')
  const { default: Article } = await import('../../src/models/article.js')
  const { default: ArticleCategory } = await import('../../src/models/article_category.js')
  const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
  return {
    Ticket,
    Reply,
    TicketRead,
    CustomerPresence,
    AgentNotification,
    AgentProfile,
    Article,
    ArticleCategory,
    EscalatedSetting,
  }
}

async function customerTicket(attributes: Record<string, any> = {}) {
  const { Ticket } = await models()
  seq += 1
  return Ticket.create({
    requesterType: 'User',
    requesterId: CUSTOMER.id,
    reference: `PANEL-${Date.now()}-${seq}`,
    subject: `Panel ${seq}`,
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

/**
 * SQLite keeps seconds: move what happened so far into the past (activity two
 * minutes ago, the agent's read a minute ago), so a new reply is later than both.
 */
async function backdateReads() {
  const { TicketRead, Ticket } = await models()
  const format =
    (TicketRead.query() as any).client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
  await TicketRead.query()
    .whereNotNull('last_read_at')
    .update({ last_read_at: DateTime.now().minus({ minutes: 1 }).toFormat(format) })
  await Ticket.query()
    .whereNotNull('last_customer_activity_at')
    .update({ last_customer_activity_at: DateTime.now().minus({ minutes: 2 }).toFormat(format) })
}

async function clean() {
  const m = await models()
  await m.AgentNotification.query().delete()
  await m.CustomerPresence.query().delete()
  await m.TicketRead.query().delete()
  await m.Reply.query().delete()
  await m.Ticket.query().delete()
  await m.AgentProfile.query().delete()
  await m.Article.query().delete()
  await m.ArticleCategory.query().delete()
  clearAgentInboxCache()
}

/** Event listeners run after the emitting request returns; wait for their writes. */
async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  let value = await read()
  for (let i = 0; i < 50 && !done(value); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20))
    value = await read()
  }
  return value
}

test.group('Agent panel data', (group) => {
  let base: string
  let agent: InertiaClient
  let admin: InertiaClient
  let customer: InertiaClient
  let original: any

  const json = (client: InertiaClient, method: string, path: string, data?: unknown) =>
    client.visit(method, path, { data, headers: JSON_HEADERS, inertia: false })

  async function rows(client: InertiaClient = agent): Promise<Record<string, any>> {
    const response = await client.visit('GET', INDEX)
    if (response.status !== 200)
      throw new Error(`${response.status} ${JSON.stringify(response.body)}`)
    return Object.fromEntries(
      response.body.props.tickets.data.map((row: any) => [row.reference, row])
    )
  }

  async function open(ticket: any, client: InertiaClient = agent) {
    const response = await client.visit('GET', `${INDEX}/${ticket.reference}`)
    if (response.status !== 200)
      throw new Error(`${response.status} ${JSON.stringify(response.body)}`)
    return response.body.props
  }

  group.setup(async () => {
    const running = await testApp()
    base = running.baseUrl
    agent = new InertiaClient(base, { user: AGENT })
    admin = new InertiaClient(base, { user: ADMIN })
    customer = new InertiaClient(base, { user: CUSTOMER })
    original = getConfig().agentInbox
    getConfig().agentInbox = { cacheSeconds: 0 }
    await clean()
  })
  group.teardown(async () => {
    getConfig().agentInbox = original
    await clean()
  })
  group.each.teardown(async () => {
    await clean()
  })

  // ---- 3. The agent's own status ------------------------------------------

  for (const method of ['PUT', 'POST']) {
    test(`an agent sets their own status with ${method}`, async ({ assert }) => {
      const { AgentProfile } = await models()
      const response = await json(agent, method, '/support/agent/status', { status: 'away' })
      assert.equal(response.status, 200)
      assert.deepEqual(response.body, { agent_status: 'away' })
      const profile = await AgentProfile.query().where('user_id', AGENT.id).firstOrFail()
      assert.equal(profile.chatStatus, 'away')
    })
  }

  test('a status outside the allowed values is rejected', async ({ assert }) => {
    const { AgentProfile } = await models()
    const response = await json(agent, 'PUT', '/support/agent/status', { status: 'busy' })
    assert.equal(response.status, 422)
    assert.isNull(await AgentProfile.query().where('user_id', AGENT.id).first())
  })

  test('the status route is refused to a non-agent', async ({ assert }) => {
    const response = await json(customer, 'PUT', '/support/agent/status', { status: 'online' })
    assert.notEqual(response.status, 200)
  })

  test('an Inertia visit goes back', async ({ assert }) => {
    const response = await agent.visit('PUT', '/support/agent/status', {
      data: { status: 'away' },
      referer: INDEX,
    })
    assert.include([302, 303], response.status)
    assert.equal(response.location, INDEX)
  })

  test('the agent chat status route stays an alias for the same field', async ({ assert }) => {
    const panel = await import('../../src/services/agent_panel.js')
    const response = await json(agent, 'POST', '/support/agent/chats/status', { status: 'online' })
    assert.deepEqual(response.body, { status: 'online', agent_status: 'online' })
    assert.equal(await panel.agentStatus(AGENT.id), 'online')
  })

  test('agents share their status and the notification count; customers do not', async ({
    assert,
  }) => {
    const { escalatedSharedData } = await import('../../src/support/shared_data.js')
    const staff = await escalatedSharedData({ auth: { user: AGENT } })
    assert.equal(staff.agent_status, 'offline')
    assert.deepEqual(staff.agent_statuses, ['online', 'away', 'offline'])
    assert.deepEqual(staff.notifications, { unread_count: 0 })

    const shared = await escalatedSharedData({ auth: { user: CUSTOMER } })
    assert.notProperty(shared, 'agent_status')
    assert.notProperty(shared, 'agent_statuses')
    assert.notProperty(shared, 'notifications')
  })

  // ---- 5. Knowledge-base search ----------------------------------------------

  async function article(values: Record<string, any> = {}) {
    const { Article } = await models()
    seq += 1
    return Article.create({
      title: `Article ${seq}`,
      slug: `article-${seq}-${Date.now()}`,
      body: '<p>Body</p>',
      status: 'published',
      ...values,
    } as any)
  }

  async function enableKb(enabled = true) {
    const { EscalatedSetting } = await models()
    await EscalatedSetting.set('knowledge_base_enabled', enabled ? '1' : '0')
  }

  const search = (query: string) => json(agent, 'GET', `/support/agent/kb/search?${query}`)

  test('kb search returns published articles with the contract fields', async ({ assert }) => {
    await enableKb()
    const { ArticleCategory } = await models()
    const category = await ArticleCategory.create({
      name: 'Billing',
      slug: `billing-${Date.now()}`,
    } as any)
    const found = await article({
      title: 'Resetting your password',
      slug: 'resetting-your-password',
      body: '<p>Open <strong>Settings</strong> and choose Reset.</p>',
      categoryId: category.id,
    })
    await found.refresh()

    const response = await search('q=password')
    assert.equal(response.status, 200)
    assert.deepEqual(response.body, {
      data: [
        {
          id: found.id,
          title: 'Resetting your password',
          excerpt: 'Open Settings and choose Reset.',
          url: `${base}/support/kb/resetting-your-password`,
          category: { id: category.id, name: 'Billing' },
          updated_at: found.updatedAt.toUTC().toISO(),
        },
      ],
    })
  })

  test('kb search never returns drafts and ignores case', async ({ assert }) => {
    await enableKb()
    await article({ title: 'Draft about refunds', status: 'draft' })
    const live = await article({ title: 'Refunds Explained' })
    const response = await search('q=REFUNDS')
    assert.deepEqual(
      response.body.data.map((row: any) => row.id),
      [live.id]
    )
  })

  test('kb search ranks title matches first, then the most recently updated', async ({
    assert,
  }) => {
    await enableKb()
    const { Article } = await models()
    const bodyOnly = await article({ title: 'Getting started', body: 'How invoices work' })
    const older = await article({ title: 'Invoices (old)' })
    const newer = await article({ title: 'Invoices (new)' })
    const format = (Article.query() as any).client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
    const at = (days: number) => DateTime.now().minus({ days }).toFormat(format)
    await Article.query()
      .where('id', bodyOnly.id)
      .update({ updated_at: at(0) })
    await Article.query()
      .where('id', older.id)
      .update({ updated_at: at(3) })
    await Article.query()
      .where('id', newer.id)
      .update({ updated_at: at(2) })

    const response = await search('q=invoices')
    assert.deepEqual(
      response.body.data.map((row: any) => row.id),
      [newer.id, older.id, bodyOnly.id]
    )
  })

  for (const q of ['%25%25', '__', '0%25', 'a_b']) {
    test(`kb search takes LIKE wildcards literally (${q})`, async ({ assert }) => {
      await enableKb()
      await article({ title: 'Plain title', body: 'Nothing special' })
      const literal = await article({ title: 'Codes: 100%% off, a_b and x__y', body: 'x' })
      const response = await search(`q=${q}`)
      assert.deepEqual(
        response.body.data.map((row: any) => row.id),
        [literal.id]
      )
    })
  }

  test('kb search caps the number of results and validates the query', async ({ assert }) => {
    await enableKb()
    for (let i = 0; i < 25; i += 1) await article({ title: `Shipping guide ${i}` })
    assert.lengthOf(await search('q=shipping').then((value: any) => value.body.data), 10)
    assert.lengthOf(await search('q=shipping&limit=20').then((value: any) => value.body.data), 20)
    assert.equal(await search('q=shipping&limit=21').then((value: any) => value.status), 422)
    for (const query of ['q=', 'q=a', `q=${'a'.repeat(201)}`, '']) {
      assert.equal(await search(query).then((value: any) => value.status), 422, query)
    }
  })

  test('kb search answers 404 while the knowledge base is off', async ({ assert }) => {
    await enableKb(false)
    assert.equal(await search('q=password').then((value: any) => value.status), 404)
  })

  // ---- 1. Unread tickets -----------------------------------------------------

  test('a new ticket is unread until the agent opens it', async ({ assert }) => {
    const ticket = await customerTicket()
    assert.isTrue(await rows().then((value: any) => value[ticket.reference].is_unread))
    assert.isFalse(await open(ticket).then((value: any) => value.ticket.is_unread))
    assert.isFalse(await rows().then((value: any) => value[ticket.reference].is_unread))
    // Per agent: an admin who has not opened it still sees it unread.
    assert.isTrue(await rows(admin).then((value: any) => value[ticket.reference].is_unread))
  })

  test('a customer reply makes a read ticket unread again', async ({ assert }) => {
    const { default: TicketService } = await import('../../src/services/ticket_service.js')
    const ticket = await customerTicket()
    await open(ticket)
    await backdateReads()
    await new TicketService().reply(ticket, CUSTOMER as any, 'Any news?')
    assert.isTrue(await rows().then((value: any) => value[ticket.reference].is_unread))
  })

  test('agent replies, notes and system replies do not make a ticket unread', async ({
    assert,
  }) => {
    const { default: TicketService } = await import('../../src/services/ticket_service.js')
    const { Reply } = await models()
    const ticket = await customerTicket()
    await open(ticket)
    await backdateReads()
    const service = new TicketService()
    await service.reply(ticket, AGENT as any, 'From the agent')
    await service.reply(ticket, ADMIN as any, 'From an admin')
    await service.addNote(ticket, CUSTOMER as any, 'A note')
    await Reply.create({
      ticketId: ticket.id,
      body: 'Workflow',
      isInternalNote: false,
      isPinned: false,
      type: 'reply',
      metadata: { workflow_id: 1 },
    } as any)
    assert.isFalse(await rows().then((value: any) => value[ticket.reference].is_unread))
  })

  test('tickets are marked read and unread through the agent routes', async ({ assert }) => {
    const ticket = await customerTicket()
    let response = await json(agent, 'POST', `${INDEX}/${ticket.reference}/read`)
    assert.deepEqual(response.body, { is_unread: false })
    assert.isFalse(await rows().then((value: any) => value[ticket.reference].is_unread))

    response = await json(agent, 'POST', `${INDEX}/${ticket.reference}/unread`)
    assert.deepEqual(response.body, { is_unread: true })
    assert.isTrue(await rows().then((value: any) => value[ticket.reference].is_unread))
  })

  test('tickets are marked read and unread in bulk', async ({ assert }) => {
    const a = await customerTicket()
    const b = await customerTicket()
    await agent.visit('POST', `${INDEX}/bulk`, {
      data: { ticket_ids: [a.id, b.id], action: 'mark_read' },
      referer: INDEX,
    })
    let flags = await rows()
    assert.deepEqual([flags[a.reference].is_unread, flags[b.reference].is_unread], [false, false])

    await agent.visit('POST', `${INDEX}/bulk`, {
      data: { ticket_ids: [a.id], action: 'mark_unread' },
      referer: INDEX,
    })
    flags = await rows()
    assert.deepEqual([flags[a.reference].is_unread, flags[b.reference].is_unread], [true, false])
  })

  test('inbox.unread counts unread open tickets per queue', async ({ assert }) => {
    const mine = await customerTicket({ assignedTo: AGENT.id })
    await customerTicket({ assignedTo: AGENT.id })
    const unassigned = await customerTicket()
    await customerTicket({ status: 'resolved', resolvedAt: DateTime.now() })
    await open(mine)
    await open(unassigned)

    const response = await agent.visit('GET', INDEX)
    assert.deepEqual(response.body.props.inbox.unread, { mine: 1, unassigned: 0, all: 1 })
  })

  test('only tickets the agent may see are counted and marked', async ({ assert, cleanup }) => {
    const { default: Department } = await import('../../src/models/department.js')
    const { TicketRead } = await models()
    const support = await Department.create({
      name: 'Panel support',
      slug: `panel-support-${Date.now()}`,
      isActive: true,
    })
    const sales = await Department.create({
      name: 'Panel sales',
      slug: `panel-sales-${Date.now()}`,
      isActive: true,
    })
    await support.attachAgent(AGENT.id)
    const previous = (getConfig() as any).visibility
    ;(getConfig() as any).visibility = 'department'
    cleanup(async () => {
      ;(getConfig() as any).visibility = previous
    })
    const visible = await customerTicket({ departmentId: support.id })
    const hidden = await customerTicket({ departmentId: sales.id })

    assert.equal(
      await agent.visit('GET', INDEX).then((value: any) => value.body.props.inbox.unread.all),
      1
    )
    const response = await json(agent, 'POST', `${INDEX}/${hidden.reference}/read`)
    assert.equal(response.status, 404)
    await agent.visit('POST', `${INDEX}/bulk`, {
      data: { ticket_ids: [hidden.id, visible.id], action: 'mark_read' },
      referer: INDEX,
    })
    const markers = await TicketRead.query()
    assert.deepEqual(
      markers.map((m) => m.ticketId),
      [visible.id]
    )
  })

  // ---- 2. Customer presence -----------------------------------------------------

  const visitPortal = () => customer.visit('GET', '/support')
  const lastSeen = async () => {
    const { CustomerPresence } = await models()
    const row = await CustomerPresence.query().firstOrFail()
    return row.lastSeenAt.toMillis()
  }

  test('a customer is online while the portal saw them within the window', async ({ assert }) => {
    const { CustomerPresence } = await models()
    const ticket = await customerTicket()
    let row = await rows().then((value: any) => value[ticket.reference])
    assert.deepEqual([row.requester_online, row.requester_last_seen_at], [false, null])

    assert.equal(await visitPortal().then((value: any) => value.status), 200)
    row = await rows().then((value: any) => value[ticket.reference])
    assert.isTrue(row.requester_online)
    assert.isString(row.requester_last_seen_at)

    const format =
      (CustomerPresence.query() as any).client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
    await CustomerPresence.query().update({
      last_seen_at: DateTime.now().minus({ seconds: 121 }).toFormat(format),
    })
    assert.isFalse(await rows().then((value: any) => value[ticket.reference].requester_online))
  })

  test('presence is written at most once every 30 seconds', async ({ assert }) => {
    const { CustomerPresence } = await models()
    await visitPortal()
    const first = await lastSeen()
    await visitPortal()
    assert.equal(await lastSeen(), first)

    const format =
      (CustomerPresence.query() as any).client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
    const old = DateTime.now().minus({ seconds: 31 })
    await CustomerPresence.query().update({ last_seen_at: old.toFormat(format) })
    await visitPortal()
    const third = await lastSeen()
    assert.isAbove(third, old.toMillis() + 20_000)
    assert.lengthOf(await CustomerPresence.query(), 1)
  })

  test('presence is sent on the agent ticket page and never to customers', async ({ assert }) => {
    const ticket = await customerTicket()
    await visitPortal()
    assert.isTrue(await open(ticket).then((value: any) => value.ticket.requester_online))

    const page = await customer.visit('GET', `/support/${ticket.reference}`)
    assert.equal(page.status, 200)
    assert.notInclude(JSON.stringify(page.body), 'requester_online')
    assert.notInclude(JSON.stringify(page.body), 'requester_last_seen_at')
  })

  test('staff browsing the customer portal are not recorded', async ({ assert }) => {
    const { CustomerPresence } = await models()
    await agent.visit('GET', '/support')
    assert.lengthOf(await CustomerPresence.query(), 0)
  })

  // ---- 4. Notifications ---------------------------------------------------------------

  async function feed(client: InertiaClient = agent, query = '', count = 0) {
    return eventually(
      async () =>
        await json(client, 'GET', `/support/agent/notifications${query}`).then(
          (value: any) => value.body
        ),
      (body: any) => (body?.data?.length ?? 0) >= count
    )
  }

  async function assign(ticket: any, agentId: number, causer: any) {
    const { default: AssignmentService } = await import('../../src/services/assignment_service.js')
    await new AssignmentService().assign(ticket, agentId, causer)
  }

  test('a ticket assignment is listed with the contract shape', async ({ assert }) => {
    const { AgentNotification } = await models()
    const ticket = await customerTicket({ subject: 'Printer on fire' })
    await assign(ticket, AGENT.id, ADMIN)

    const body = await feed(agent, '', 1)
    const row = await AgentNotification.query().firstOrFail()
    assert.deepEqual(body, {
      data: [
        {
          id: row.id,
          type: 'ticket_assigned',
          title: `${ticket.reference} was assigned to you`,
          body: 'Printer on fire',
          ticket: { id: ticket.id, reference: ticket.reference, subject: 'Printer on fire' },
          url: `/support/agent/tickets/${ticket.reference}`,
          created_at: row.createdAt.toUTC().toISO(),
          read_at: null,
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 20, total: 1 },
      unread_count: 1,
    })
  })

  test('assigning a ticket to yourself notifies nobody', async ({ assert }) => {
    await assign(await customerTicket(), AGENT.id, AGENT)
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.deepEqual(await feed().then((value: any) => value.data), [])
  })

  test("the assignee hears of customer replies, not of another agent's", async ({ assert }) => {
    const { default: TicketService } = await import('../../src/services/ticket_service.js')
    const ticket = await customerTicket({ assignedTo: AGENT.id })
    await new TicketService().reply(ticket, ADMIN as any, 'From a colleague')
    await new TicketService().reply(ticket, CUSTOMER as any, 'From the customer')

    const body = await feed(agent, '', 1)
    await new Promise((resolve) => setTimeout(resolve, 100))
    assert.deepEqual(
      await feed().then((value: any) => value.data.map((item: any) => [item.type, item.title])),
      [['ticket_reply', `New reply on ${ticket.reference}`]]
    )
    assert.lengthOf(body.data, 1)
  })

  test('the assignee hears of SLA warnings and breaches; transfers reach the receiver', async ({
    assert,
  }) => {
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    const ticket = await customerTicket({ assignedTo: AGENT.id })
    await emitter.emit(ESCALATED_EVENTS.SLA_WARNING as any, {
      ticket,
      type: 'first_response',
      minutesRemaining: 20,
    })
    await emitter.emit(ESCALATED_EVENTS.SLA_BREACHED as any, { ticket, type: 'resolution' })
    await emitter.emit(ESCALATED_EVENTS.CHAT_TRANSFERRED as any, {
      ticket,
      sessionId: 7,
      fromAgentId: ADMIN.id,
      toAgentId: AGENT.id,
    })

    const items = await feed(agent, '', 3).then((value: any) => value.data)
    assert.sameMembers(
      items.map((item: any) => item.type),
      ['sla_warning', 'sla_breached', 'chat_transferred']
    )
    assert.equal(
      items.find((item: any) => item.type === 'sla_warning').title,
      `SLA due soon on ${ticket.reference}`
    )
  })

  test('the feed pages newest first, filters to unread and marks read', async ({ assert }) => {
    const { AgentNotification } = await models()
    for (let i = 1; i <= 3; i += 1) {
      await assign(await customerTicket({ subject: `Ticket ${i}` }), AGENT.id, ADMIN)
      await feed(agent, '', i)
    }
    const format =
      (AgentNotification.query() as any).client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
    // Give them distinct times (SQLite keeps seconds), oldest first.
    const ordered = await AgentNotification.query().then((value: any) =>
      value.sort((a: any, b: any) => Number(a.data.ticket_id) - Number(b.data.ticket_id))
    )
    for (const [i, row] of ordered.entries()) {
      await AgentNotification.query()
        .where('id', row.id)
        .update({
          created_at: DateTime.now()
            .minus({ minutes: 10 - i })
            .toFormat(format),
        })
    }

    const first = await feed(agent, '?per_page=2')
    assert.deepEqual(
      first.data.map((item: any) => item.body),
      ['Ticket 3', 'Ticket 2']
    )
    assert.deepEqual(first.meta, { current_page: 1, last_page: 2, per_page: 2, total: 3 })

    const read = await json(agent, 'POST', `/support/agent/notifications/${first.data[0].id}/read`)
    assert.deepEqual(read.body, { unread_count: 2 })
    assert.deepEqual(
      await feed(agent, '?unread=1').then((value: any) => value.data.map((item: any) => item.body)),
      ['Ticket 2', 'Ticket 1']
    )
    assert.equal(
      await json(agent, 'GET', '/support/agent/notifications?per_page=51').then(
        (value: any) => value.status
      ),
      422
    )
    const all = await json(agent, 'POST', '/support/agent/notifications/read-all')
    assert.deepEqual(all.body, { unread_count: 0 })
    assert.equal(await feed().then((value: any) => value.unread_count), 0)
  })

  test("another agent's notification cannot be marked read", async ({ assert }) => {
    const { AgentNotification } = await models()
    await assign(await customerTicket(), AGENT.id, ADMIN)
    await feed(agent, '', 1)
    const row = await AgentNotification.query().firstOrFail()
    const response = await json(admin, 'POST', `/support/agent/notifications/${row.id}/read`)
    assert.equal(response.status, 404)
    await row.refresh()
    assert.isNull(row.readAt)
  })

  test('a ticket the agent can no longer view is redacted', async ({ assert, cleanup }) => {
    const { default: Department } = await import('../../src/models/department.js')
    const { Ticket } = await models()
    const support = await Department.create({
      name: 'Redact support',
      slug: `redact-support-${Date.now()}`,
      isActive: true,
    })
    const billing = await Department.create({
      name: 'Redact billing',
      slug: `redact-billing-${Date.now()}`,
      isActive: true,
    })
    await support.attachAgent(AGENT.id)
    const ticket = await customerTicket({ departmentId: support.id, subject: 'Secret subject' })
    await assign(ticket, AGENT.id, ADMIN)
    await feed(agent, '', 1)
    const previous = (getConfig() as any).visibility
    ;(getConfig() as any).visibility = 'department'
    cleanup(async () => {
      ;(getConfig() as any).visibility = previous
    })
    await Ticket.query().where('id', ticket.id).update({ department_id: billing.id })

    const item = await feed().then((value: any) => value.data[0])
    assert.equal(item.title, 'A ticket you can no longer view')
    assert.deepEqual([item.body, item.ticket, item.url], [null, null, null])
    assert.notInclude(JSON.stringify(item), 'Secret subject')
  })

  test('the feed is off when switched off, and for agents only', async ({ assert, cleanup }) => {
    ;(getConfig() as any).agentNotifications = false
    cleanup(async () => {
      delete (getConfig() as any).agentNotifications
    })
    assert.equal(
      await json(agent, 'GET', '/support/agent/notifications').then((value: any) => value.status),
      404
    )
    assert.equal(
      await json(agent, 'POST', '/support/agent/notifications/read-all').then(
        (value: any) => value.status
      ),
      404
    )
    const { escalatedSharedData } = await import('../../src/support/shared_data.js')
    assert.notProperty(await escalatedSharedData({ auth: { user: AGENT } }), 'notifications')

    delete (getConfig() as any).agentNotifications
    assert.notEqual(
      await json(customer, 'GET', '/support/agent/notifications').then(
        (value: any) => value.status
      ),
      200
    )
  })
})
