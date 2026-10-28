import { test } from '@japa/runner'
import { withGuestProof } from './fixtures/guest_codes.js'
import { chatSessionIdFor } from './fixtures/chat_sessions.js'
import { sqlTimestamp, testApp, TEST_USER_HEADER, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { MemoryGuestRateLimitStore } from '../../src/support/guest_rate_limit.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| End Chat from the shared ticket view
|--------------------------------------------------------------------------
|
| The shared Agent/TicketShow page resolves `route('escalated.admin.chat.end',
| ticket.chat_session_id)` and, when it resolves, POSTs `{}` to it as JSON.
| escalated-laravel serves that name at POST {prefix}/admin/chat/{session}/end
| (422 when the chat already ended). The older escalated.agent.chats.end route
| keeps working as before.
|
*/

const WIDGET = '/support/widget'

test.group('Chat end route', (group) => {
  let running: TestApp
  let previous: Record<string, unknown>
  let sequence = 0

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
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set('widget_enabled', '1')
    return () => {
      Object.assign(config, previous)
    }
  })

  async function post(path: string, body: unknown, user: { id: number | string } | null) {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    }
    if (user) headers[TEST_USER_HEADER] = String(user.id)
    const response = await fetch(running.baseUrl + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    const text = await response.text()
    let data: any = text
    try {
      data = JSON.parse(text)
    } catch {}
    return { status: response.status, data, text }
  }

  async function acceptedChat() {
    const path = WIDGET + '/chat/start'
    const body = await withGuestProof('POST', path, {
      name: 'Erin Visitor',
      email: `erin-${Date.now()}-${++sequence}@example.com`,
      message: '',
    })
    const started = await post(path, body, null)
    if (started.status !== 201) throw new Error(`chat start: ${started.status} ${started.text}`)
    const sessionId = await chatSessionIdFor(started.data.id)
    const accepted = await post(`/support/agent/chats/${sessionId}/accept`, {}, TEST_USERS.agent)
    if (accepted.status !== 200) throw new Error(`accept: ${accepted.status} ${accepted.text}`)
    return sessionId
  }

  async function chatState(sessionId: number) {
    const { default: ChatSession } = await import('../../src/models/chat_session.js')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const session = await ChatSession.findOrFail(sessionId)
    const ticket = await Ticket.findOrFail(session.ticketId)
    return { session, ticket }
  }

  async function endUrl(sessionId: number) {
    const router = await running.app.container.make('router')
    return router.makeUrl('escalated.admin.chat.end', [sessionId])
  }

  test('escalated.admin.chat.end resolves to the Laravel path for a session id', async ({
    assert,
  }) => {
    assert.equal(await endUrl(42), '/support/admin/chat/42/end')
  })

  test('posting {} to escalated.admin.chat.end as an agent ends the chat', async ({ assert }) => {
    const sessionId = await acceptedChat()

    const ended = await post(await endUrl(sessionId), {}, TEST_USERS.agent)
    assert.equal(ended.status, 200, ended.text)
    assert.equal(ended.data.message, 'Chat ended.')

    const { session, ticket } = await chatState(sessionId)
    assert.equal(session.status, 'ended')
    assert.isNotNull(session.endedAt)
    assert.equal(ticket.status, 'resolved')
    assert.isNotNull(ticket.chatEndedAt)
  })

  test('escalated.admin.chat.end refuses a chat that already ended with 422', async ({
    assert,
  }) => {
    const sessionId = await acceptedChat()
    const url = await endUrl(sessionId)
    const first = await post(url, {}, TEST_USERS.agent)
    assert.equal(first.status, 200, first.text)

    const again = await post(url, {}, TEST_USERS.agent)
    assert.equal(again.status, 422, again.text)
    assert.equal(again.data.message, 'Chat is already ended.')
  })

  test('escalated.admin.chat.end is for agents only', async ({ assert }) => {
    const sessionId = await acceptedChat()
    const url = await endUrl(sessionId)

    const customer = await post(url, {}, TEST_USERS.customer)
    assert.equal(customer.status, 403, customer.text)
    const guest = await post(url, {}, null)
    assert.equal(guest.status, 401, guest.text)
    const { session } = await chatState(sessionId)
    assert.equal(session.status, 'active')
  })

  test('escalated.agent.chats.end still ends a chat at its own path', async ({ assert }) => {
    const sessionId = await acceptedChat()
    const router = await running.app.container.make('router')
    const url = router.makeUrl('escalated.agent.chats.end', [sessionId])
    assert.equal(url, `/support/agent/chats/${sessionId}/end`)

    const ended = await post(url, {}, TEST_USERS.agent)
    assert.equal(ended.status, 200, ended.text)
    assert.equal(ended.data.session.id, sessionId)
    assert.equal(ended.data.session.status, 'ended')
    const { session } = await chatState(sessionId)
    assert.equal(session.status, 'ended')
  })
})
