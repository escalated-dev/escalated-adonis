import { test } from '@japa/runner'
import { withGuestProof } from './fixtures/guest_codes.js'
import {
  InertiaClient,
  sqlTimestamp,
  testApp,
  TEST_USER_HEADER,
  type TestApp,
} from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { MemoryGuestRateLimitStore } from '../../src/support/guest_rate_limit.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| The shared event vocabulary
|--------------------------------------------------------------------------
|
| escalated-developer-context ADR 2026-10-21: webhooks and workflow triggers
| are emitted under the canonical names only, and the names earlier releases
| stored (a webhook's `events`, a workflow's `trigger_event`) are read as
| aliases of the canonical name. Live chat emits chat.started, chat.assigned,
| chat.transferred, chat.message and chat.ended.
|
*/

const WIDGET = '/support/widget'
const WEBHOOKS = '/support/admin/webhooks'
const WORKFLOWS = '/support/admin/workflows'

const ADR_LEGACY: Record<string, string> = {
  'ticket.replied': 'reply.created',
  'internal_note.added': 'note.created',
  'internal_note.created': 'note.created',
  'tag.added': 'ticket.tag_added',
  'ticket.tagged': 'ticket.tag_added',
  'tag.removed': 'ticket.tag_removed',
  'ticket.untagged': 'ticket.tag_removed',
  'chat.session_started': 'chat.started',
  'chat.session_ended': 'chat.ended',
}

const CANONICAL = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.resolved',
  'ticket.closed',
  'ticket.reopened',
  'ticket.assigned',
  'ticket.unassigned',
  'ticket.escalated',
  'ticket.priority_changed',
  'ticket.department_changed',
  'ticket.tag_added',
  'ticket.tag_removed',
  'reply.created',
  'note.created',
  'sla.warning',
  'sla.breached',
  'chat.started',
  'chat.assigned',
  'chat.transferred',
  'chat.message',
  'chat.ended',
]

test.group('Event vocabulary', (group) => {
  let running: TestApp
  let previous: Record<string, unknown>
  const webhookIds: number[] = []

  group.setup(async () => {
    running = await testApp()
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
  })

  group.each.timeout(30_000)

  group.each.setup(async () => {
    const config = getConfig() as any
    previous = { guestRateLimit: config.guestRateLimit }
    config.guestRateLimit = { store: new MemoryGuestRateLimitStore() }
    await setting('widget_enabled', '1')
    await running.db.from('escalated_workflow_logs').delete()
    await running.db.from('escalated_workflows').delete()
    return async () => {
      Object.assign(config, previous)
      for (const id of webhookIds.splice(0)) {
        await running.db.from('escalated_webhook_deliveries').where('webhook_id', id).delete()
        await running.db.from('escalated_webhooks').where('id', id).delete()
      }
    }
  })

  async function setting(key: string, value: string) {
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set(key, value)
  }

  /** A webhook stored the way an earlier release stored it. `.invalid` never resolves. */
  async function webhook(events: string[]) {
    const { default: Webhook } = await import('../../src/models/webhook.js')
    const hook = await Webhook.create({
      url: 'http://escalated-vocabulary-test.invalid/hook',
      events,
      active: true,
      secret: null,
    })
    webhookIds.push(hook.id)
    return hook
  }

  /** The events recorded in a webhook's delivery log, waiting for the async dispatch. */
  async function deliveredEvents(webhookId: number, expected: number) {
    let rows: Array<{ event: string; payload: any }> = []
    for (let attempt = 0; attempt < 50; attempt++) {
      rows = await running.db
        .from('escalated_webhook_deliveries')
        .where('webhook_id', webhookId)
        .orderBy('id', 'asc')
      if (rows.length >= expected) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return rows.map((row) => ({
      event: row.event,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    }))
  }

  let sequence = 0
  async function openTicket(subject: string) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `VOCAB-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject,
      description: 'Opened by the event vocabulary tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  async function widget(method: string, path: string, body: unknown = null) {
    body = await withGuestProof(method, WIDGET + path, body)
    const response = await fetch(running.baseUrl + WIDGET + path, {
      method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()
    let data: any = text
    try {
      data = JSON.parse(text)
    } catch {}
    return { status: response.status, ok: response.ok, data, text }
  }

  async function agent(
    method: string,
    path: string,
    body: unknown = null,
    user = TEST_USERS.agent
  ) {
    const response = await fetch(running.baseUrl + '/support/agent/chats' + path, {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        [TEST_USER_HEADER]: String(user.id),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()
    return { status: response.status, ok: response.ok, text }
  }

  // ---- Webhooks ------------------------------------------------------------

  test('the admin form offers exactly the canonical names', async ({ assert }) => {
    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    const page = await client.visit('GET', WEBHOOKS)
    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.sameMembers(page.body.props.availableEvents, CANONICAL)
  })

  test('saving a webhook with legacy names stores the canonical ones', async ({ assert }) => {
    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    const visit = await client.visit('POST', WEBHOOKS, {
      data: {
        url: 'https://93.184.216.34/escalated-vocabulary',
        events: ['ticket.tagged', 'internal_note.added', 'ticket.replied', 'chat.session_started'],
      },
      referer: WEBHOOKS,
    })
    assert.equal(visit.status, 302, JSON.stringify(visit.body))

    const { default: Webhook } = await import('../../src/models/webhook.js')
    const stored = await Webhook.query()
      .where('url', 'https://93.184.216.34/escalated-vocabulary')
      .firstOrFail()
    webhookIds.push(stored.id)
    assert.sameMembers(stored.events, [
      'ticket.tag_added',
      'note.created',
      'reply.created',
      'chat.started',
    ])
  })

  test('the admin index shows a legacy subscription under its canonical names', async ({
    assert,
  }) => {
    const hook = await webhook(['tag.added', 'ticket.tag_added', 'internal_note.created'])
    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    const page = await client.visit('GET', WEBHOOKS)
    const row = page.body.props.webhooks.find((w: any) => w.id === hook.id)
    assert.deepEqual(row.events, ['ticket.tag_added', 'note.created'])
  })

  test('every legacy name in the ADR is read as its canonical name', async ({ assert }) => {
    const hook = await webhook(Object.keys(ADR_LEGACY))
    for (const [legacy, canonical] of Object.entries(ADR_LEGACY)) {
      assert.isTrue(hook.subscribedTo(canonical), `${legacy} should receive ${canonical}`)
    }
  })

  test('a webhook subscribed under legacy names receives the events under canonical names', async ({
    assert,
  }) => {
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    const { default: Tag } = await import('../../src/models/tag.js')

    const hook = await webhook(['ticket.tagged', 'internal_note.added'])
    const ticket = await openTicket('Legacy subscription')
    const tag = await Tag.create({ name: `vip-${Date.now()}`, slug: `vip-${Date.now()}` } as any)

    await emitter.emit(ESCALATED_EVENTS.TAG_ADDED, { ticket, tag })

    const delivered = await deliveredEvents(hook.id, 1)
    assert.deepEqual(
      delivered.map((d) => d.event),
      ['ticket.tag_added']
    )
  })

  test('a live chat sends chat.started, chat.message, chat.assigned, chat.transferred and chat.ended', async ({
    assert,
  }) => {
    const hook = await webhook([
      'chat.started',
      'chat.message',
      'chat.assigned',
      'chat.transferred',
      'chat.session_ended',
    ])

    const started = await widget('POST', '/chat/start', {
      name: 'Jane Visitor',
      email: `jane-${Date.now()}@example.com`,
      message: '',
    })
    assert.equal(started.status, 201, started.text)
    const sessionId = started.data.session_id

    const sent = await widget('POST', `/chat/${started.data.id}/messages`, { body: 'Hello?' })
    assert.isTrue(sent.ok, sent.text)

    const accepted = await agent('POST', `/${sessionId}/accept`)
    assert.isTrue(accepted.ok, accepted.text)

    const transferred = await agent('POST', `/${sessionId}/transfer`, {
      agent_id: TEST_USERS.admin.id,
    })
    assert.isTrue(transferred.ok, transferred.text)

    const ended = await widget('POST', `/chat/${started.data.id}/end`)
    assert.isTrue(ended.ok, ended.text)

    const delivered = await deliveredEvents(hook.id, 5)
    assert.deepEqual(
      delivered.map((d) => d.event),
      ['chat.started', 'chat.message', 'chat.assigned', 'chat.transferred', 'chat.ended']
    )
    for (const delivery of delivered) {
      assert.equal(delivery.payload.chat.session_id, sessionId, delivery.event)
      assert.equal(delivery.payload.ticket.id, started.data.ticket_id ?? delivery.payload.ticket.id)
    }
    const transfer = delivered.find((d) => d.event === 'chat.transferred')!
    assert.equal(transfer.payload.chat.from_agent_id, TEST_USERS.agent.id)
    assert.equal(transfer.payload.chat.to_agent_id, TEST_USERS.admin.id)
    const assigned = delivered.find((d) => d.event === 'chat.assigned')!
    assert.equal(assigned.payload.agent_id, TEST_USERS.agent.id)
  })

  // ---- Chat transfer body ----------------------------------------------------
  // The shared ChatActionBar posts {"agent_id"} or {"department_id"} (what
  // escalated-laravel's ChatController::transfer reads); the ticket view
  // offers departments. The older {"type", "id"} body is read too.

  async function acceptedChat() {
    const started = await widget('POST', '/chat/start', {
      name: 'Dee Visitor',
      email: `dee-${Date.now()}-${++sequence}@example.com`,
      message: '',
    })
    assert201(started)
    const sessionId = started.data.session_id
    const accepted = await agent('POST', `/${sessionId}/accept`)
    if (!accepted.ok) throw new Error(accepted.text)
    return sessionId as number
  }

  function assert201(response: { status: number; text: string }) {
    if (response.status !== 201) throw new Error(`chat start: ${response.status} ${response.text}`)
  }

  async function department() {
    const { default: Department } = await import('../../src/models/department.js')
    const stamp = `${Date.now()}-${++sequence}`
    return Department.create({ name: `Billing ${stamp}`, slug: `billing-${stamp}`, isActive: true })
  }

  async function chatState(sessionId: number) {
    const { default: ChatSession } = await import('../../src/models/chat_session.js')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const session = await ChatSession.findOrFail(sessionId)
    const ticket = await Ticket.findOrFail(session.ticketId)
    return { session, ticket }
  }

  test('a department transfer moves the ticket and puts the chat back in the queue', async ({
    assert,
  }) => {
    const hook = await webhook(['chat.transferred'])
    const sessionId = await acceptedChat()
    const billing = await department()

    const transferred = await agent('POST', `/${sessionId}/transfer`, { department_id: billing.id })
    assert.isTrue(transferred.ok, transferred.text)

    const { session, ticket } = await chatState(sessionId)
    assert.equal(session.status, 'waiting')
    assert.isNull(session.agentId)
    assert.equal(session.departmentId, billing.id)
    assert.equal(ticket.departmentId, billing.id)
    assert.isNull(ticket.assignedTo)

    const [delivery] = await deliveredEvents(hook.id, 1)
    assert.equal(delivery.event, 'chat.transferred')
    assert.equal(delivery.payload.chat.from_agent_id, TEST_USERS.agent.id)
    assert.isNull(delivery.payload.chat.to_agent_id)
    assert.equal(delivery.payload.chat.to_department_id, billing.id)
  })

  test('a transfer to an agent and a department does both', async ({ assert }) => {
    const sessionId = await acceptedChat()
    const billing = await department()

    const transferred = await agent('POST', `/${sessionId}/transfer`, {
      agent_id: TEST_USERS.admin.id,
      department_id: billing.id,
    })
    assert.isTrue(transferred.ok, transferred.text)

    const { session, ticket } = await chatState(sessionId)
    assert.equal(session.status, 'active')
    assert.equal(session.agentId, TEST_USERS.admin.id)
    assert.equal(ticket.departmentId, billing.id)
    assert.equal(ticket.assignedTo, TEST_USERS.admin.id)
  })

  test('the type and id transfer body is still read', async ({ assert }) => {
    const sessionId = await acceptedChat()
    const billing = await department()

    const transferred = await agent('POST', `/${sessionId}/transfer`, {
      type: 'department',
      id: billing.id,
    })
    assert.isTrue(transferred.ok, transferred.text)
    const { ticket } = await chatState(sessionId)
    assert.equal(ticket.departmentId, billing.id)
  })

  test('a transfer needs a known target', async ({ assert }) => {
    const sessionId = await acceptedChat()

    const none = await agent('POST', `/${sessionId}/transfer`, {})
    assert.equal(none.status, 400)
    const unknown = await agent('POST', `/${sessionId}/transfer`, { department_id: 999999 })
    assert.equal(unknown.status, 422)
    const { session } = await chatState(sessionId)
    assert.equal(session.agentId, TEST_USERS.agent.id)
    assert.equal(session.status, 'active')
  })

  // ---- Workflows -----------------------------------------------------------

  async function storeWorkflow(triggerEvent: string, tagName: string) {
    await running.db.table('escalated_workflows').insert({
      name: `Vocabulary ${triggerEvent}`,
      trigger_event: triggerEvent,
      conditions: JSON.stringify({ all: [] }),
      actions: JSON.stringify([{ type: 'add_tag', value: tagName }]),
      is_active: true,
      position: 0,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
  }

  async function tagNames(ticketId: number): Promise<string[]> {
    const rows = await running.db
      .from('escalated_ticket_tag')
      .join('escalated_tags', 'escalated_tags.id', 'escalated_ticket_tag.tag_id')
      .where('escalated_ticket_tag.ticket_id', ticketId)
      .select('escalated_tags.name')
    return rows.map((row: { name: string }) => row.name)
  }

  test('a workflow stored with the legacy ticket.replied trigger still runs on replies', async ({
    assert,
  }) => {
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    const { default: Reply } = await import('../../src/models/reply.js')

    await storeWorkflow('ticket.replied', 'replied-legacy')
    const ticket = await openTicket('Legacy reply trigger')
    const reply = await Reply.create({
      ticketId: ticket.id,
      authorType: 'User',
      authorId: TEST_USERS.customer.id,
      body: 'Any news?',
      isInternalNote: false,
      isPinned: false,
      type: 'reply',
    } as any)
    await emitter.emit(ESCALATED_EVENTS.REPLY_CREATED, { reply })

    assert.include(await tagNames(ticket.id), 'replied-legacy')
  })

  test('the admin shows and saves a legacy trigger under its canonical name', async ({
    assert,
  }) => {
    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await storeWorkflow('ticket.replied', 'shown')
    const index = await client.visit('GET', WORKFLOWS)
    const shown = index.body.props.workflows.find(
      (w: any) => w.name === 'Vocabulary ticket.replied'
    )
    assert.equal(shown.trigger_event, 'reply.created')
    assert.equal(shown.trigger, 'reply.created')

    const visit = await client.visit('POST', WORKFLOWS, {
      data: {
        name: 'Posted with a legacy trigger',
        trigger_event: 'ticket.replied',
        conditions: { all: [] },
        actions: [{ type: 'add_tag', value: 'x' }],
        is_active: true,
      },
      referer: `${WORKFLOWS}/create`,
    })
    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, WORKFLOWS)
    const stored = await running.db
      .from('escalated_workflows')
      .where('name', 'Posted with a legacy trigger')
      .first()
    assert.equal(stored.trigger_event, 'reply.created')
  })

  test('chat.started and chat.ended run workflows', async ({ assert }) => {
    await storeWorkflow('chat.started', 'chat-began')
    await storeWorkflow('chat.session_ended', 'chat-finished')

    const started = await widget('POST', '/chat/start', {
      name: 'Jane Visitor',
      email: `jane-wf-${Date.now()}@example.com`,
      message: '',
    })
    assert.equal(started.status, 201, started.text)
    const { default: ChatSession } = await import('../../src/models/chat_session.js')
    const session = await ChatSession.findOrFail(started.data.session_id)
    assert.include(await tagNames(session.ticketId), 'chat-began')

    const ended = await widget('POST', `/chat/${started.data.id}/end`)
    assert.isTrue(ended.ok, ended.text)
    assert.include(await tagNames(session.ticketId), 'chat-finished')
  })
})
