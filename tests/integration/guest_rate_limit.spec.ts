import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { MemoryGuestRateLimitStore } from '../../src/support/guest_rate_limit.js'

/*
|--------------------------------------------------------------------------
| Guest endpoint rate limiting
|--------------------------------------------------------------------------
|
| The guest ticket form, the widget's ticket endpoint and the guest reply
| endpoint are unauthenticated, and every accepted request writes rows and
| sends outbound mail. The package caps them per client IP itself (ticket
| creation 5/min, guest replies 10/min by default) rather than relying on each
| host to put a throttle in front.
|
*/

test.group('Guest endpoint rate limiting', (group) => {
  let running: TestApp
  let previous: unknown

  group.setup(async () => {
    running = await testApp()
    // The settings migration seeds rows with a JS Date, which SQLite stores as a
    // number Lucid cannot read back; the guest form reads one of those rows.
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
  })

  group.each.timeout(30_000)

  group.each.setup(() => {
    const config = (globalThis as any).__escalated_config
    previous = config.guestRateLimit
    // A fresh store per test: every request in this suite comes from 127.0.0.1.
    config.guestRateLimit = { store: new MemoryGuestRateLimitStore() }
    return () => {
      config.guestRateLimit = previous
    }
  })

  function configure(options: Record<string, unknown>) {
    const config = (globalThis as any).__escalated_config
    config.guestRateLimit = { ...config.guestRateLimit, ...options }
  }

  let sequence = 0

  async function guestTicket() {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const token = `${'a'.repeat(54)}${String(Date.now()).slice(-6)}${String(++sequence).padStart(4, '0')}`
    await Ticket.create({
      reference: `GRL-${Date.now()}-${sequence}`,
      requesterType: null,
      requesterId: null,
      guestName: 'Guest',
      guestEmail: 'guest@example.com',
      guestToken: token,
      subject: 'Rate limit',
      description: 'Opened by the guest rate limit tests',
      status: 'open',
      priority: 'low',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
    return token
  }

  async function statuses(times: number, send: (n: number) => Promise<{ status: number }>) {
    const out: number[] = []
    for (let i = 0; i < times; i++) {
      const { status } = await send(i)
      out.push(status)
    }
    return out
  }

  function widgetTicket(n: number) {
    // A distinct email per call, so only the per-IP limit can be what trips.
    return new InertiaClient(running.baseUrl).visit('POST', '/support/widget/tickets', {
      data: { email: `widget${n}-${Date.now()}@example.com`, subject: 'Help', description: 'd' },
    })
  }

  function guestFormTicket(n: number) {
    return new InertiaClient(running.baseUrl).visit('POST', '/support/guest', {
      data: {
        guest_name: 'Guest',
        guest_email: `guest${n}-${Date.now()}@example.com`,
        subject: 'Help',
        description: 'd',
        priority: 'low',
      },
      referer: '/support/guest/create',
    })
  }

  function reply(token: string) {
    return new InertiaClient(running.baseUrl).visit('POST', `/support/guest/${token}/reply`, {
      data: { body: 'hi' },
      referer: `/support/guest/${token}`,
    })
  }

  test('answers the 6th widget ticket from one IP within a minute with 429', async ({ assert }) => {
    const out = await statuses(6, widgetTicket)

    assert.deepEqual(out, [201, 201, 201, 201, 201, 429])
  })

  test('answers the 6th guest form ticket from one IP within a minute with 429', async ({
    assert,
  }) => {
    const out = await statuses(6, guestFormTicket)

    assert.deepEqual(out, [302, 302, 302, 302, 302, 429])
  })

  test('the 429 carries Retry-After', async ({ assert }) => {
    configure({ ticketsPerMinute: 1 })
    await widgetTicket(0)

    const visit = await widgetTicket(1)

    assert.equal(visit.status, 429)
    const retryAfter = Number(visit.headers.get('retry-after'))
    assert.isAbove(retryAfter, 0)
    assert.isAtMost(retryAfter, 60)
  })

  test('answers the 11th guest reply from one IP within a minute with 429', async ({ assert }) => {
    const token = await guestTicket()

    const out = await statuses(11, () => reply(token))

    assert.deepEqual(out.slice(0, 10), Array(10).fill(302))
    assert.equal(out[10], 429)
  })

  test('counts replies carrying a wrong guest token, so tokens cannot be guessed at speed', async ({
    assert,
  }) => {
    configure({ repliesPerMinute: 2 })

    const out = await statuses(3, () => reply('z'.repeat(64)))

    assert.deepEqual(out, [404, 404, 429])
  })

  test('counts ticket creation and replies in separate buckets', async ({ assert }) => {
    const token = await guestTicket()
    await statuses(5, widgetTicket)

    const { status } = await reply(token)

    assert.equal(status, 302)
  })

  test('takes its limits from the config', async ({ assert }) => {
    configure({ ticketsPerMinute: 2 })

    assert.deepEqual(await statuses(3, widgetTicket), [201, 201, 429])
  })

  test('lets a host that throttles upstream switch it off', async ({ assert }) => {
    configure({ enabled: false })

    const out = await statuses(8, widgetTicket)

    assert.isTrue(
      out.every((s) => s === 201),
      JSON.stringify(out)
    )
  })
})
