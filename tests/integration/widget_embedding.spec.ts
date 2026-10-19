import { readFileSync } from 'node:fs'
import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { MemoryGuestRateLimitStore } from '../../src/support/guest_rate_limit.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| Embedding the widget on other sites
|--------------------------------------------------------------------------
|
| Sites listed in `widget.allowedOrigins` or the `widget_allowed_origins`
| setting may call the widget routes from the browser: they get CORS grants,
| skip the host's CSRF check (via `isWidgetCsrfExempt` in shield's
| `csrf.exceptRoutes`) and always run as a guest. Every other request is
| handled exactly as before.
|
| The harness plays shield's CSRF guard with a stand-in that is switched on
| per test and calls `exceptRoutes(ctx)` the way shield 9 does.
|
*/

const SHOP = 'https://shop.example.com'
const EVIL = 'https://evil.example.net'

test.group('Widget embedding', (group) => {
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
    previous = {
      widget: config.widget,
      guestRateLimit: config.guestRateLimit,
      visibility: config.visibility,
    }
    config.widget = { allowedOrigins: [SHOP] }
    config.guestRateLimit = { store: new MemoryGuestRateLimitStore() }
    ;(globalThis as any).__escalated_test_csrf = true
    await setting('widget_allowed_origins', '')
    return async () => {
      Object.assign(config, previous)
      ;(globalThis as any).__escalated_test_csrf = false
      await setting('widget_allowed_origins', '')
    }
  })

  async function setting(key: string, value: string) {
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set(key, value)
  }

  async function call(
    method: string,
    path: string,
    options: { origin?: string; data?: unknown; headers?: Record<string, string> } = {}
  ) {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
    if (options.origin) headers['Origin'] = options.origin
    if (options.data !== undefined) headers['Content-Type'] = 'application/json'
    const response = await fetch(running.baseUrl + path, {
      method,
      headers,
      body: options.data === undefined ? undefined : JSON.stringify(options.data),
    })
    const text = await response.text()
    let body: any = text
    try {
      body = JSON.parse(text)
    } catch {}
    return { status: response.status, headers: response.headers, body, text }
  }

  let sequence = 0
  function ticketPayload(extra: Record<string, unknown> = {}) {
    sequence++
    return {
      name: 'Jane Doe',
      email: `jane${sequence}-${Date.now()}@example.com`,
      subject: `Where is my order? ${sequence}-${Date.now()}`,
      description: 'It has not arrived yet.',
      ...extra,
    }
  }

  async function ticketByReference(reference: string) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.query().where('reference', reference).firstOrFail()
  }

  test('answers a preflight from an allowed site', async ({ assert }) => {
    const response = await call('OPTIONS', '/support/widget/tickets', {
      origin: SHOP,
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization',
      },
    })

    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), SHOP)
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS')
    assert.include(response.headers.get('access-control-allow-headers')!, 'Content-Type')
    assert.include(response.headers.get('access-control-allow-headers')!, 'Authorization')
    assert.equal(response.headers.get('access-control-max-age'), '600')
    assert.include(response.headers.get('vary')!, 'Origin')
    assert.isNull(response.headers.get('access-control-allow-credentials'))
  })

  test('answers a preflight on the chat routes too', async ({ assert }) => {
    const response = await call('OPTIONS', '/support/widget/chat/start', {
      origin: SHOP,
      headers: { 'Access-Control-Request-Method': 'POST' },
    })

    assert.equal(response.status, 204)
    assert.equal(response.headers.get('access-control-allow-origin'), SHOP)
  })

  test('gives no CORS grant to a site that is not allowed', async ({ assert }) => {
    const preflight = await call('OPTIONS', '/support/widget/tickets', {
      origin: EVIL,
      headers: { 'Access-Control-Request-Method': 'POST' },
    })
    const config = await call('GET', '/support/widget/config', { origin: EVIL })

    assert.equal(preflight.status, 204)
    assert.isNull(preflight.headers.get('access-control-allow-origin'))
    assert.equal(config.status, 200)
    assert.isNull(config.headers.get('access-control-allow-origin'))
  })

  test('lets an allowed site create a ticket without a CSRF token', async ({ assert }) => {
    const response = await call('POST', '/support/widget/tickets', {
      origin: SHOP,
      data: ticketPayload(),
    })

    assert.equal(response.status, 201, response.text)
    assert.equal(response.headers.get('access-control-allow-origin'), SHOP)
    assert.equal(response.headers.get('access-control-expose-headers'), 'Retry-After')
    assert.include(response.headers.get('vary')!, 'Origin')
    await ticketByReference(response.body.ticket_reference)
  })

  for (const [label, origin] of [
    ['a site that is not allowed', EVIL],
    ['the same site', 'SAME'],
    ['a request without Origin', undefined],
  ] as const) {
    test(`still requires a CSRF token from ${label}`, async ({ assert }) => {
      const payload = ticketPayload()
      const response = await call('POST', '/support/widget/tickets', {
        origin: origin === 'SAME' ? running.baseUrl : origin,
        data: payload,
      })

      assert.equal(response.status, 403, response.text)
      assert.isNull(response.headers.get('access-control-allow-origin'))
      const { default: Ticket } = await import('../../src/models/ticket.js')
      assert.isNull(await Ticket.query().where('subject', payload.subject).first())
    })
  }

  test('reads allowed sites from the admin setting, including subdomain wildcards', async ({
    assert,
  }) => {
    ;(getConfig() as any).widget = { allowedOrigins: [] }
    await setting('widget_allowed_origins', 'https://*.brand.test\nhttp://localhost:5173')

    const allowed = async (origin: string) => {
      const response = await call('GET', '/support/widget/config', { origin })
      return response.headers.get('access-control-allow-origin')
    }

    assert.equal(await allowed('https://help.brand.test'), 'https://help.brand.test')
    assert.equal(await allowed('https://a.b.brand.test'), 'https://a.b.brand.test')
    assert.equal(await allowed('http://localhost:5173'), 'http://localhost:5173')
    assert.isNull(await allowed('https://brand.test'))
    assert.isNull(await allowed('http://help.brand.test'))
    assert.isNull(await allowed('https://evilbrand.test'))
    assert.isNull(await allowed('http://localhost:5174'))

    // Once read, the setting also exempts that site from the CSRF check.
    const created = await call('POST', '/support/widget/tickets', {
      origin: 'https://help.brand.test',
      data: ticketPayload(),
    })
    assert.equal(created.status, 201, created.text)
  })

  test('refuses a request the CSRF check let through once the site is no longer allowed', async ({
    assert,
  }) => {
    ;(getConfig() as any).widget = { allowedOrigins: [] }
    await setting('widget_allowed_origins', 'https://blog.example.com')
    await call('GET', '/support/widget/config', { origin: 'https://blog.example.com' })
    // Removed by an admin in another process: this process's copy is stale.
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.query().where('key', 'widget_allowed_origins').update({ value: '' })

    const response = await call('POST', '/support/widget/tickets', {
      origin: 'https://blog.example.com',
      data: ticketPayload(),
    })

    assert.equal(response.status, 403, response.text)
    assert.isNull(response.headers.get('access-control-allow-origin'))
  })

  test('treats an embedded visitor as a guest even when signed in', async ({ assert }) => {
    const { default: Department } = await import('../../src/models/department.js')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const department = await Department.create({
      name: 'Embed other',
      slug: `embed-other-${Date.now()}`,
      isActive: true,
    })
    const token = 'b'.repeat(64)
    await Ticket.create({
      reference: `EMBED-${Date.now()}`,
      requesterType: null,
      requesterId: null,
      guestEmail: 'guest@example.com',
      guestToken: token,
      subject: 'Hidden from the agent',
      description: 'd',
      status: 'open',
      priority: 'low',
      channel: 'widget',
      departmentId: department.id,
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
    ;(getConfig() as any).visibility = 'department'
    const agent = { 'x-test-user-id': String(TEST_USERS.agent.id) }

    const sameSite = await call('GET', `/support/widget/tickets/${token}`, { headers: agent })
    const embedded = await call('GET', `/support/widget/tickets/${token}`, {
      origin: SHOP,
      headers: agent,
    })

    assert.equal(sameSite.status, 404)
    assert.equal(embedded.status, 200, embedded.text)
    assert.equal(embedded.headers.get('access-control-allow-origin'), SHOP)
  })

  test('adds CORS headers to error answers for allowed sites', async ({ assert }) => {
    const invalid = await call('POST', '/support/widget/tickets', {
      origin: SHOP,
      data: { name: 'x' },
    })
    const missing = await call('GET', `/support/widget/tickets/${'c'.repeat(64)}`, {
      origin: SHOP,
    })

    assert.equal(invalid.status, 400)
    assert.equal(invalid.headers.get('access-control-allow-origin'), SHOP)
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('access-control-allow-origin'), SHOP)
  })

  test('adds CORS headers to rate-limit answers for allowed sites', async ({ assert }) => {
    ;(getConfig() as any).guestRateLimit.ticketsPerMinute = 1

    await call('POST', '/support/widget/tickets', { origin: SHOP, data: ticketPayload() })
    const limited = await call('POST', '/support/widget/tickets', {
      origin: SHOP,
      data: ticketPayload(),
    })

    assert.equal(limited.status, 429)
    assert.equal(limited.headers.get('access-control-allow-origin'), SHOP)
    assert.include(limited.headers.get('access-control-expose-headers')!, 'Retry-After')
    assert.isNotNull(limited.headers.get('retry-after'))
  })

  test('tells the widget it accepts host parameters, keeping the other keys', async ({
    assert,
  }) => {
    const response = await call('GET', '/support/widget/config')

    assert.equal(response.status, 200)
    assert.equal(response.body.accepts_metadata, true)
    assert.properties(response.body, [
      'brand_name',
      'accent_color',
      'logo_url',
      'knowledge_base_enabled',
    ])
  })

  test('stores sanitised host parameters sent with a widget ticket', async ({ assert }) => {
    const response = await call('POST', '/support/widget/tickets', {
      origin: SHOP,
      data: ticketPayload({
        metadata: {
          'order_number': 'A-1001',
          'plan': 'pro',
          'items': 3,
          'source': 'spoofed',
          'page_url': 'https://shop.example.com/orders/A-1001',
          'embedded_on': 'https://spoofed.example',
          'nested': { not: 'kept' },
          'bad key!': 'dropped',
          'note': 'a'.repeat(600),
        },
      }),
    })

    assert.equal(response.status, 201, response.text)
    const ticket = await ticketByReference(response.body.ticket_reference)
    assert.deepEqual(ticket.metadata, {
      order_number: 'A-1001',
      plan: 'pro',
      items: 3,
      page_url: 'https://shop.example.com/orders/A-1001',
      note: 'a'.repeat(500),
      embedded_on: SHOP,
      source: 'widget',
    })
  })

  test('drops a page_url that is not a web address', async ({ assert }) => {
    const response = await call('POST', '/support/widget/tickets', {
      origin: SHOP,
      data: ticketPayload({ metadata: { page_url: 'javascript:alert(1)', plan: 'pro' } }),
    })

    const ticket = await ticketByReference(response.body.ticket_reference)
    assert.deepEqual(ticket.metadata, { plan: 'pro', embedded_on: SHOP, source: 'widget' })
  })

  test('leaves widget tickets without host parameters unchanged', async ({ assert }) => {
    ;(globalThis as any).__escalated_test_csrf = false

    const response = await call('POST', '/support/widget/tickets', { data: ticketPayload() })

    assert.equal(response.status, 201, response.text)
    const ticket = await ticketByReference(response.body.ticket_reference)
    assert.deepEqual(ticket.metadata, { source: 'widget' })
  })

  test('rejects metadata that is not an object', async ({ assert }) => {
    const response = await call('POST', '/support/widget/tickets', {
      origin: SHOP,
      data: ticketPayload({ metadata: 'order A-1001' }),
    })

    assert.equal(response.status, 400)
    assert.equal(response.headers.get('access-control-allow-origin'), SHOP)
  })

  test('lets an allowed site start a live chat and keeps its sanitised host parameters', async ({
    assert,
  }) => {
    const response = await call('POST', '/support/widget/chat/start', {
      origin: SHOP,
      data: {
        name: 'John Doe',
        email: 'john@example.com',
        message: 'Hello',
        metadata: {
          'page_url': 'https://shop.example.com/cart',
          'cart_total': 129.5,
          'deep': { x: 1 },
          'bad key': 1,
        },
      },
    })

    assert.equal(response.status, 201, response.text)
    assert.equal(response.headers.get('access-control-allow-origin'), SHOP)
    const expected = {
      page_url: 'https://shop.example.com/cart',
      cart_total: 129.5,
      embedded_on: SHOP,
    }
    const ticket = await ticketByReference(response.body.ticket_reference)
    assert.deepEqual(ticket.chatMetadata, expected)
    assert.deepEqual(ticket.metadata, { source: 'live_chat' })
    const { default: ChatSession } = await import('../../src/models/chat_session.js')
    const session = await ChatSession.findOrFail(response.body.session_id)
    assert.deepEqual(session.metadata, expected)
  })

  test('serves the standalone widget script for other sites to load', async ({ assert }) => {
    const bundle = readFileSync(
      new URL('../../resources/widget/escalated-widget.js', import.meta.url),
      'utf8'
    )

    const response = await call('GET', '/support/widget/embed.js', { origin: EVIL })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'application/javascript; charset=utf-8')
    assert.equal(response.headers.get('cache-control'), 'public, max-age=3600')
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin')
    assert.equal(response.headers.get('access-control-allow-origin'), '*')
    assert.equal(response.text, bundle)
    const etag = response.headers.get('etag')
    assert.isString(etag)

    const cached = await call('GET', '/support/widget/embed.js', {
      headers: { 'If-None-Match': etag! },
    })
    assert.equal(cached.status, 304)
    assert.equal(cached.headers.get('etag'), etag)
    assert.equal(cached.text, '')
  })

  test('lets admins list embedding sites and rejects invalid ones', async ({ assert }) => {
    ;(globalThis as any).__escalated_test_csrf = false
    const admin = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')

    const saved = await admin.visit('POST', '/support/admin/settings', {
      data: { widget_allowed_origins: 'https://shop.example.com\nhttps://*.brand.test' },
      referer: '/support/admin/settings',
    })
    assert.equal(saved.status, 302, JSON.stringify(saved.body))
    assert.equal(
      await EscalatedSetting.get('widget_allowed_origins'),
      'https://shop.example.com\nhttps://*.brand.test'
    )

    const page = await admin.visit('GET', '/support/admin/settings')
    assert.equal(
      page.body.props.settings.widget_allowed_origins,
      'https://shop.example.com\nhttps://*.brand.test'
    )

    const refused = await admin.visit('POST', '/support/admin/settings', {
      data: {
        widget_allowed_origins: 'https://shop.example.com/checkout\n*',
        ticket_reference_prefix: 'NOPE',
      },
      referer: '/support/admin/settings',
    })
    assert.equal(refused.status, 302)
    const after = await admin.visit('GET', '/support/admin/settings')
    assert.include(String(after.body.flash.error), 'https://shop.example.com/checkout')
    assert.equal(
      await EscalatedSetting.get('widget_allowed_origins'),
      'https://shop.example.com\nhttps://*.brand.test'
    )
    assert.notEqual(await EscalatedSetting.get('ticket_reference_prefix'), 'NOPE')
  })
})
