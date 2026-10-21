import { test } from '@japa/runner'
import { withGuestProof } from './fixtures/guest_codes.js'
import { sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { MemoryGuestRateLimitStore } from '../../src/support/guest_rate_limit.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| The shared widget's API contract
|--------------------------------------------------------------------------
|
| `@escalated-dev/escalated`'s EscalatedWidget.vue calls these routes. Each
| test sends exactly the request the widget sends and checks the fields it
| reads. The older fields and routes stay as they were for existing clients.
|
*/

const SHOP = 'https://shop.example.com'
const WIDGET = '/support/widget'

test.group('Widget API contract', (group) => {
  let running: TestApp
  let previous: Record<string, unknown>

  group.setup(async () => {
    running = await testApp()
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
  })

  group.each.timeout(30_000)

  group.each.setup(async () => {
    const config = getConfig() as any
    previous = { widget: config.widget, guestRateLimit: config.guestRateLimit }
    config.widget = { allowedOrigins: [SHOP] }
    config.guestRateLimit = { store: new MemoryGuestRateLimitStore() }
    return async () => {
      Object.assign(config, previous)
      await setting('widget_enabled', '1')
      await setting('knowledge_base_enabled', '0')
      await setting('widget_accent_color', '#3B82F6')
    }
  })

  async function setting(key: string, value: string) {
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set(key, value)
  }

  /** The widget's `api()`: JSON in and out, Accept + Content-Type on every call. */
  async function api(
    method: string,
    path: string,
    body: unknown = null,
    options: { origin?: string } = {}
  ) {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
    if (options.origin) headers['Origin'] = options.origin
    // Tickets and chats carry the emailed code, as the widget sends it.
    body = await withGuestProof(method, WIDGET + path, body)
    const response = await fetch(running.baseUrl + WIDGET + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await response.text()
    let data: any = text
    try {
      data = JSON.parse(text)
    } catch {}
    return { status: response.status, ok: response.ok, headers: response.headers, data, text }
  }

  let sequence = 0
  function unique(label: string) {
    sequence++
    return `${label}-${sequence}-${Date.now()}`
  }

  async function department(isActive = true) {
    const { default: Department } = await import('../../src/models/department.js')
    const slug = unique('widget-dept')
    return Department.create({ name: `Dept ${slug}`, slug, isActive })
  }

  /** The widget's `startLiveChat()` body. */
  function preChat(extra: Record<string, unknown> = {}) {
    return {
      name: 'Jane Visitor',
      email: `${unique('jane')}@example.com`,
      department_id: null,
      message: '',
      ...extra,
    }
  }

  test('config carries the keys the widget reads, beside the existing ones', async ({ assert }) => {
    await setting('widget_accent_color', '#123456')
    await setting('knowledge_base_enabled', '1')
    const active = await department(true)
    const inactive = await department(false)

    const response = await api('GET', '/config')

    assert.equal(response.status, 200, response.text)
    const config = response.data
    assert.equal(config.enabled, true)
    assert.equal(config.color, '#123456')
    assert.equal(config.position, 'bottom-right')
    assert.isString(config.greeting)
    assert.isTrue(config.greeting.length > 0)
    assert.equal(config.kb_enabled, true)
    assert.equal(config.guest_tickets_enabled, true)
    assert.equal(config.accepts_metadata, true)
    assert.isArray(config.departments)
    assert.deepInclude(config.departments, { id: active.id, name: active.name })
    assert.notOk(config.departments.find((d: any) => d.id === inactive.id))
    for (const entry of config.departments) assert.sameMembers(Object.keys(entry), ['id', 'name'])
    // Tickets, chats and status lookups take an emailed code (docs/guest-access.md).
    assert.equal(config.status_lookup_enabled, true)
    assert.equal(config.guest_verification_required, true)
    // Existing clients keep their keys.
    assert.equal(config.accent_color, '#123456')
    assert.equal(config.knowledge_base_enabled, true)
    assert.properties(config, ['brand_name', 'logo_url'])

    await setting('knowledge_base_enabled', '0')
    const switchedOff = await api('GET', '/config')
    assert.equal(switchedOff.data.kb_enabled, false)
  })

  test('config answers 403 { enabled: false } when the widget is switched off', async ({
    assert,
  }) => {
    await setting('widget_enabled', '0')

    const response = await api('GET', '/config')

    assert.equal(response.status, 403)
    assert.equal(response.data.enabled, false)
  })

  test('article search and detail return the fields the widget renders', async ({ assert }) => {
    await setting('knowledge_base_enabled', '1')
    const { default: Article } = await import('../../src/models/article.js')
    const { default: ArticleCategory } = await import('../../src/models/article_category.js')
    const { DateTime } = await import('luxon')
    const slug = unique('reset-password')
    const category = await ArticleCategory.create({
      name: 'Accounts',
      slug: unique('accounts'),
      position: 0,
    } as any)
    await Article.create({
      title: `Reset your password ${slug}`,
      slug,
      body: '<p>Open <strong>Settings</strong> and choose Reset.</p>',
      status: 'published',
      categoryId: category.id,
      publishedAt: DateTime.now(),
    } as any)

    const search = await api('GET', `/articles?q=${encodeURIComponent(slug)}`)

    assert.equal(search.status, 200, search.text)
    assert.lengthOf(search.data.articles, 1)
    const summary = search.data.articles[0]
    assert.equal(summary.slug, slug)
    assert.equal(summary.title, `Reset your password ${slug}`)
    assert.equal(summary.excerpt, 'Open Settings and choose Reset.')

    const detail = await api('GET', `/articles/${slug}`)

    assert.equal(detail.status, 200, detail.text)
    assert.equal(detail.data.title, `Reset your password ${slug}`)
    assert.equal(detail.data.slug, slug)
    assert.equal(detail.data.body, '<p>Open <strong>Settings</strong> and choose Reset.</p>')
    assert.deepEqual(detail.data.category, { id: category.id, name: 'Accounts' })
    // The wrapped shape stays for existing clients.
    assert.equal(detail.data.article.slug, slug)
    assert.isArray(detail.data.related)
  })

  test('a widget ticket answers with a top-level reference', async ({ assert }) => {
    const subject = unique('Where is my order?')
    const response = await api('POST', '/tickets', {
      name: 'Jane Doe',
      email: `${unique('jane')}@example.com`,
      subject,
      description: 'It has not arrived yet.',
      department_id: null,
    })

    assert.equal(response.status, 201, response.text)
    assert.isString(response.data.reference)
    assert.isString(response.data.message)
    // Existing keys stay.
    assert.equal(response.data.ticket_reference, response.data.reference)
    // The permanent token gave way to an expiring grant.
    assert.isString(response.data.guest_access_token)
    assert.isString(response.data.expires_at)
    assert.notProperty(response.data, 'guest_token')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const ticket = await Ticket.query().where('reference', response.data.reference).firstOrFail()
    assert.equal(ticket.subject, subject)
  })

  test('a widget ticket keeps an active department and ignores any other', async ({ assert }) => {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const active = await department(true)
    const inactive = await department(false)
    const create = (departmentId: unknown) =>
      api('POST', '/tickets', {
        name: 'Jane Doe',
        email: `${unique('jane')}@example.com`,
        subject: unique('Billing'),
        description: 'Question about my invoice.',
        department_id: departmentId,
      })

    for (const [departmentId, expected] of [
      [active.id, active.id],
      [String(active.id), active.id],
      [inactive.id, null],
      [999_999, null],
      ['nope', null],
    ] as const) {
      const response = await create(departmentId)
      assert.equal(response.status, 201, response.text)
      const ticket = await Ticket.query().where('reference', response.data.reference).firstOrFail()
      assert.equal(ticket.departmentId, expected, `department_id ${departmentId}`)
    }
  })

  test('a refused widget ticket carries a message the widget can show', async ({ assert }) => {
    const response = await api('POST', '/tickets', {
      name: 'Jane Doe',
      email: '',
      subject: '',
      description: '',
      department_id: null,
    })

    assert.equal(response.status, 400)
    assert.isString(response.data.message)
    assert.isString(response.data.error)
  })

  test('a chat starts without a first message and answers with an unguessable id', async ({
    assert,
  }) => {
    const response = await api('POST', '/chat/start', preChat())

    assert.equal(response.status, 201, response.text)
    assert.match(response.data.id, /^[0-9a-f]{64}$/)
    assert.equal(response.data.id, response.data.visitor_token)
    assert.equal(response.data.status, 'waiting')
    assert.deepEqual(response.data.messages, [])
    // Existing keys stay.
    assert.isNumber(response.data.session_id)
    assert.isString(response.data.ticket_reference)

    const { default: Reply } = await import('../../src/models/reply.js')
    const { default: ChatSession } = await import('../../src/models/chat_session.js')
    const session = await ChatSession.findOrFail(response.data.session_id)
    assert.lengthOf(await Reply.query().where('ticket_id', session.ticketId), 0)
  })

  test('a chat started with a message returns it in the widget message shape', async ({
    assert,
  }) => {
    const response = await api('POST', '/chat/start', preChat({ message: 'Hello there' }))

    assert.equal(response.status, 201, response.text)
    assert.lengthOf(response.data.messages, 1)
    const [first] = response.data.messages
    assert.equal(first.body, 'Hello there')
    assert.equal(first.is_agent, false)
    assert.deepEqual(first.author, { name: 'Jane Visitor' })
    assert.isNumber(first.id)
    assert.isString(first.created_at)
  })

  test('a chat keeps an active department and ignores any other', async ({ assert }) => {
    const { default: ChatSession } = await import('../../src/models/chat_session.js')
    const active = await department(true)
    const inactive = await department(false)

    const kept = await api('POST', '/chat/start', preChat({ department_id: active.id }))
    const dropped = await api('POST', '/chat/start', preChat({ department_id: inactive.id }))

    assert.equal(kept.status, 201, kept.text)
    assert.equal(dropped.status, 201, dropped.text)
    const keptSession = await ChatSession.findOrFail(kept.data.session_id)
    const droppedSession = await ChatSession.findOrFail(dropped.data.session_id)
    assert.equal(keptSession.departmentId, active.id)
    assert.isNull(droppedSession.departmentId)
  })

  test('runs a whole chat through the widget paths', async ({ assert }) => {
    const started = await api('POST', '/chat/start', preChat({ message: 'Hi' }))
    assert.equal(started.status, 201, started.text)
    const id = started.data.id

    const sent = await api('POST', `/chat/${id}/messages`, { body: 'Is anyone there?' })
    assert.isTrue(sent.ok, sent.text)

    // An agent picks the chat up and answers.
    const { default: ChatSessionService } =
      await import('../../src/services/chat_session_service.js')
    const { default: ChatSession } = await import('../../src/models/chat_session.js')
    const service = new ChatSessionService()
    const session = await ChatSession.findOrFail(started.data.session_id)
    await ChatSession.query().where('id', session.id).update({
      agent_id: TEST_USERS.agent.id,
      status: 'active',
    })
    await service.sendMessage(
      session.id,
      { id: TEST_USERS.agent.id, type: TEST_USERS.agent.constructor.name },
      'Hello, how can I help?'
    )

    const typing = await api('POST', `/chat/${id}/typing`)
    assert.isTrue(typing.ok, typing.text)

    const polled = await api('GET', `/chat/${id}/messages`)
    assert.equal(polled.status, 200, polled.text)
    assert.deepEqual(
      polled.data.messages.map((m: any) => [m.body, m.is_agent, m.author.name]),
      [
        ['Hi', false, 'Jane Visitor'],
        ['Is anyone there?', false, 'Jane Visitor'],
        ['Hello, how can I help?', true, 'Agent 2'],
      ]
    )
    for (const message of polled.data.messages) {
      assert.isNumber(message.id)
      assert.isString(message.created_at)
    }
    assert.deepEqual(polled.data.agent, { name: 'Agent 2' })
    assert.equal(polled.data.ended, false)
    assert.property(polled.data, 'typing')

    const ended = await api('POST', `/chat/${id}/end`)
    assert.isTrue(ended.ok, ended.text)
    const afterEnd = await api('GET', `/chat/${id}/messages`)
    assert.equal(afterEnd.data.ended, true)

    const rated = await api('POST', `/chat/${id}/rate`, { rating: 4, comment: 'Quick answer' })
    assert.isTrue(rated.ok, rated.text)
    const after = await ChatSession.findOrFail(session.id)
    assert.equal(after.rating, 4)
    assert.equal(after.ratingComment, 'Quick answer')
  })

  test('the older singular message route still works', async ({ assert }) => {
    const started = await api('POST', '/chat/start', preChat())

    const sent = await api('POST', `/chat/${started.data.visitor_token}/message`, {
      body: 'Still here',
    })

    assert.equal(sent.status, 200, sent.text)
    assert.equal(sent.data.message.body, 'Still here')
  })

  test('a visitor message needs a body', async ({ assert }) => {
    const started = await api('POST', '/chat/start', preChat())

    const response = await api('POST', `/chat/${started.data.id}/messages`, { body: '' })

    assert.equal(response.status, 400)
    assert.isString(response.data.message)
  })

  test('chat paths refuse a token that names no chat', async ({ assert }) => {
    const unknown = 'f'.repeat(64)

    const answers = [
      await api('GET', `/chat/${unknown}/messages`),
      await api('POST', `/chat/${unknown}/messages`, { body: 'x' }),
      await api('POST', `/chat/${unknown}/typing`),
      await api('GET', '/chat/123/messages'),
    ]

    assert.deepEqual(
      answers.map((answer) => answer.status),
      [404, 404, 404, 404]
    )
  })

  test('the new chat routes get CORS for an allowed site', async ({ assert }) => {
    const started = await api('POST', '/chat/start', preChat(), { origin: SHOP })
    assert.equal(started.status, 201, started.text)
    const id = started.data.id

    const preflight = await fetch(`${running.baseUrl}${WIDGET}/chat/${id}/messages`, {
      method: 'OPTIONS',
      headers: { 'Origin': SHOP, 'Access-Control-Request-Method': 'POST' },
    })
    const polled = await api('GET', `/chat/${id}/messages`, null, { origin: SHOP })
    const sent = await api('POST', `/chat/${id}/messages`, { body: 'Hi' }, { origin: SHOP })
    const missing = await api('GET', `/chat/${'e'.repeat(64)}/messages`, null, { origin: SHOP })

    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), SHOP)
    assert.equal(polled.headers.get('access-control-allow-origin'), SHOP)
    assert.isTrue(sent.ok, sent.text)
    assert.equal(sent.headers.get('access-control-allow-origin'), SHOP)
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('access-control-allow-origin'), SHOP)
  })
})
