import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { guestProof, latestCode, sentCodes } from './fixtures/guest_codes.js'
import { MemoryGuestRateLimitStore } from '../../src/support/guest_rate_limit.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| Verified guest access
|--------------------------------------------------------------------------
|
| Ports escalated-laravel's verified guest access (docs/guest-access.md):
| guest tickets, widget chats and lookups need an eight-digit code emailed to
| the guest, and guests open their tickets with expiring, hashed grants
| instead of permanent tokens.
|
*/

const GUEST = '/support/guest'
const WIDGET = '/support/widget'

test.group('Verified guest access', (group) => {
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
      guestRateLimit: config.guestRateLimit,
      guestAccess: { ...config.guestAccess },
    }
    // The per-IP guest limits have their own spec; these tests post many times.
    config.guestRateLimit = {
      store: new MemoryGuestRateLimitStore(),
      ticketsPerMinute: 100,
      repliesPerMinute: 100,
    }
    config.guestAccess = { ...config.guestAccess, store: new MemoryGuestRateLimitStore() }
    await setting('widget_enabled', '1')
    await setting('guest_tickets_enabled', '1')
    return () => {
      Object.assign(config, previous)
    }
  })

  async function setting(key: string, value: string) {
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set(key, value)
  }

  let sequence = 0
  function email(label = 'guest') {
    return `${label}-${++sequence}-${Date.now()}@example.com`
  }

  async function json(
    method: string,
    path: string,
    body: unknown = null,
    headers: Record<string, string> = {}
  ) {
    const response = await fetch(running.baseUrl + path, {
      method,
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    })
    const text = await response.text()
    let data: any = text
    try {
      data = JSON.parse(text)
    } catch {}
    return { status: response.status, headers: response.headers, data, text }
  }

  async function statusOf(...args: Parameters<typeof json>) {
    const answer = await json(...args)
    return answer.status
  }

  async function visitStatus(client: InertiaClient, method: string, path: string) {
    const visit = await client.visit(method, path)
    return visit.status
  }

  function widgetTicket(address: string, extra: Record<string, unknown> = {}) {
    return {
      name: 'Grace Guest',
      email: address,
      subject: 'Where is my order?',
      description: 'It has not arrived.',
      ...extra,
    }
  }

  async function createWidgetTicket(address = email()) {
    const created = await json(
      'POST',
      `${WIDGET}/tickets`,
      widgetTicket(address, await guestProof(address, 'ticket'))
    )
    if (created.status !== 201) throw new Error(`widget ticket: ${created.status} ${created.text}`)
    return { ...created.data, email: address }
  }

  async function ticketByReference(reference: string) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.findByOrFail('reference', reference)
  }

  // ---- Email codes ---------------------------------------------------------

  test('verification emails an eight-digit code on both surfaces', async ({ assert }) => {
    for (const prefix of [GUEST, WIDGET]) {
      const address = email()
      const response = await json('POST', `${prefix}/verification`, {
        email: address,
        purpose: 'ticket',
      })
      assert.equal(response.status, 202, response.text)
      assert.isString(response.data.verification_id)
      assert.equal(response.data.expires_in, 600)
      assert.isString(response.data.message)
      assert.notInclude(response.text, latestCode(address))
      assert.match(latestCode(address), /^\d{8}$/)
      assert.equal(response.headers.get('cache-control'), 'no-store, private')

      const { default: GuestVerification } = await import('../../src/models/guest_verification.js')
      const stored = await GuestVerification.findOrFail(response.data.verification_id)
      assert.notInclude(JSON.stringify(stored.$attributes), address)
      assert.notInclude(JSON.stringify(stored.$attributes), latestCode(address))
    }
  })

  test('verification refuses a bad email or purpose with 422', async ({ assert }) => {
    const bad = await json('POST', `${WIDGET}/verification`, { email: 'nope', purpose: 'ticket' })
    assert.equal(bad.status, 422, bad.text)
    assert.property(bad.data.errors, 'email')
    const purpose = await json('POST', `${WIDGET}/verification`, {
      email: email(),
      purpose: 'admin',
    })
    assert.equal(purpose.status, 422)
    assert.property(purpose.data.errors, 'purpose')
  })

  test('a client gets three codes per mailbox per hour, then 429 with Retry-After', async ({
    assert,
  }) => {
    const address = email()
    for (let i = 0; i < 3; i++) {
      const ok = await json('POST', `${GUEST}/verification`, { email: address, purpose: 'ticket' })
      assert.equal(ok.status, 202, ok.text)
    }
    const refused = await json('POST', `${GUEST}/verification`, {
      email: address,
      purpose: 'lookup',
    })
    assert.equal(refused.status, 429)
    assert.isAbove(Number(refused.headers.get('retry-after')), 0)
    // Another mailbox from the same client is unaffected.
    const other = await json('POST', `${GUEST}/verification`, { email: email(), purpose: 'ticket' })
    assert.equal(other.status, 202)
  })

  test('a mailbox gets ten codes per hour across clients', async ({ assert }) => {
    const { challenge, TooManyChallenges } = await import('../../src/support/guest_access.js')
    const address = email()
    for (let i = 0; i < 10; i++) await challenge(address, 'ticket', `10.0.0.${i}`)
    await assert.rejects(() => challenge(address, 'ticket', '10.0.1.1'), TooManyChallenges as any)
  })

  test('verification is refused while guest tickets or the widget are off', async ({ assert }) => {
    await setting('guest_tickets_enabled', '0')
    const off = await json('POST', `${GUEST}/verification`, { email: email(), purpose: 'ticket' })
    assert.equal(off.status, 403)
    await setting('guest_tickets_enabled', '1')
    await setting('widget_enabled', '0')
    const widget = await json('POST', `${WIDGET}/verification`, {
      email: email(),
      purpose: 'ticket',
    })
    assert.equal(widget.status, 403)
  })

  // ---- Widget tickets ------------------------------------------------------

  test('widget /config advertises verification and status lookup', async ({ assert }) => {
    const config = await json('GET', `${WIDGET}/config`)
    assert.equal(config.status, 200)
    assert.isTrue(config.data.guest_verification_required)
    assert.isTrue(config.data.status_lookup_enabled)
  })

  test('a widget ticket needs proof for its email', async ({ assert }) => {
    const address = email()
    const missing = await json('POST', `${WIDGET}/tickets`, widgetTicket(address))
    assert.equal(missing.status, 422, missing.text)
    assert.property(missing.data.errors, 'verification_code')

    const forOther = await guestProof(email(), 'ticket')
    const wrongEmail = await json('POST', `${WIDGET}/tickets`, widgetTicket(address, forOther))
    assert.equal(wrongEmail.status, 422)

    const chatProof = await guestProof(address, 'chat')
    const wrongPurpose = await json('POST', `${WIDGET}/tickets`, widgetTicket(address, chatProof))
    assert.equal(wrongPurpose.status, 422)

    const { default: Ticket } = await import('../../src/models/ticket.js')
    assert.isNull(await Ticket.query().where('guest_email', address).first())
  })

  test('a widget ticket answers with an expiring grant, never a permanent token', async ({
    assert,
  }) => {
    const address = email()
    const created = await json(
      'POST',
      `${WIDGET}/tickets`,
      widgetTicket(address, await guestProof(address, 'ticket'))
    )
    assert.equal(created.status, 201, created.text)
    assert.isString(created.data.guest_access_token)
    assert.isString(created.data.expires_at)
    assert.notProperty(created.data, 'guest_token')
    assert.equal(created.headers.get('cache-control'), 'no-store, private')

    const ticket = await ticketByReference(created.data.reference)
    assert.isNull(ticket.guestToken)
    assert.lengthOf(ticket.guestAccessHash!, 64)
    assert.notInclude(created.data.guest_access_token, ticket.guestAccessHash!)
    assert.isNotNull(ticket.guestEmailVerifiedAt)
  })

  test('a code is single use and allows five guesses', async ({ assert }) => {
    const address = email()
    const proof = await guestProof(address, 'ticket')
    for (let i = 0; i < 5; i++) {
      const wrong = await json(
        'POST',
        `${WIDGET}/tickets`,
        widgetTicket(address, { ...proof, verification_code: '00000000' })
      )
      assert.equal(wrong.status, 422)
    }
    const late = await json('POST', `${WIDGET}/tickets`, widgetTicket(address, proof))
    assert.equal(late.status, 422, 'the right code after five wrong guesses')

    const fresh = await guestProof(address, 'ticket')
    const first = await json('POST', `${WIDGET}/tickets`, widgetTicket(address, fresh))
    assert.equal(first.status, 201, first.text)
    const again = await json('POST', `${WIDGET}/tickets`, widgetTicket(address, fresh))
    assert.equal(again.status, 422)
  })

  test('an expired code is refused', async ({ assert }) => {
    const address = email()
    const proof = await guestProof(address, 'ticket')
    await running.db
      .from('escalated_guest_verifications')
      .where('id', proof.verification_id)
      .update({ expires_at: '2000-01-01 00:00:00' })
    const response = await json('POST', `${WIDGET}/tickets`, widgetTicket(address, proof))
    assert.equal(response.status, 422)
  })

  test('widget status needs the grant as a bearer, for its own reference', async ({ assert }) => {
    const created = await createWidgetTicket()
    const bearer = { Authorization: `Bearer ${created.guest_access_token}` }

    const status = await json('GET', `${WIDGET}/tickets/${created.reference}`, null, bearer)
    assert.equal(status.status, 200, status.text)
    assert.equal(status.data.reference, created.reference)
    assert.equal(status.data.status, 'open')
    assert.isString(status.data.status_label)
    assert.isString(status.data.status_color)
    assert.isArray(status.data.replies)

    const other = await createWidgetTicket()
    assert.equal(await statusOf('GET', `${WIDGET}/tickets/${other.reference}`, null, bearer), 404)
    assert.equal(await statusOf('GET', `${WIDGET}/tickets/${created.reference}`), 404)
    assert.equal(
      await statusOf('GET', `${WIDGET}/tickets/${created.reference}?email=${created.email}`),
      404
    )
  })

  // ---- Grants --------------------------------------------------------------

  test('an expired grant opens nothing', async ({ assert }) => {
    const created = await createWidgetTicket()
    const ticket = await ticketByReference(created.reference)
    await running.db
      .from('escalated_tickets')
      .where('id', ticket.id)
      .update({ guest_access_expires_at: '2000-01-01 00:00:00' })
    const status = await json('GET', `${WIDGET}/tickets/${created.reference}`, null, {
      Authorization: `Bearer ${created.guest_access_token}`,
    })
    assert.equal(status.status, 404)
    const page = await new InertiaClient(running.baseUrl).visit(
      'GET',
      `${GUEST}/${created.guest_access_token}`
    )
    assert.equal(page.status, 404)
  })

  test('lookup renews access with a fresh grant and revokes the old one', async ({ assert }) => {
    const created = await createWidgetTicket()
    const proof = await guestProof(created.email, 'lookup')

    const found = await json('POST', `${WIDGET}/lookup`, {
      email: created.email.toUpperCase(),
      reference: created.reference,
      ...proof,
    })
    assert.equal(found.status, 200, found.text)
    assert.lengthOf(found.data.data, 1)
    const match = found.data.data[0]
    assert.equal(match.reference, created.reference)
    assert.isString(match.subject)
    assert.isString(match.expires_at)
    assert.notEqual(match.guest_access_token, created.guest_access_token)

    const oldGrant = await json('GET', `${WIDGET}/tickets/${created.reference}`, null, {
      Authorization: `Bearer ${created.guest_access_token}`,
    })
    assert.equal(oldGrant.status, 404)
    const newGrant = await json('GET', `${WIDGET}/tickets/${created.reference}`, null, {
      Authorization: `Bearer ${match.guest_access_token}`,
    })
    assert.equal(newGrant.status, 200)

    // The proof was spent.
    const reused = await json('POST', `${GUEST}/lookup`, {
      email: created.email,
      reference: created.reference,
      ...proof,
    })
    assert.equal(reused.status, 422)
  })

  test('lookup needs the matching email; a reference alone unlocks nothing', async ({ assert }) => {
    const created = await createWidgetTicket()
    const stranger = email('stranger')
    const found = await json('POST', `${GUEST}/lookup`, {
      email: stranger,
      reference: created.reference,
      ...(await guestProof(stranger, 'lookup')),
    })
    assert.equal(found.status, 200, found.text)
    assert.deepEqual(found.data.data, [])

    const noProof = await json('POST', `${GUEST}/lookup`, {
      email: created.email,
      reference: created.reference,
    })
    assert.equal(noProof.status, 422)
  })

  test('changing the guest email revokes the grant', async ({ assert }) => {
    const created = await createWidgetTicket()
    const ticket = await ticketByReference(created.reference)
    ticket.guestEmail = email('changed')
    await ticket.save()
    const status = await json('GET', `${WIDGET}/tickets/${created.reference}`, null, {
      Authorization: `Bearer ${created.guest_access_token}`,
    })
    assert.equal(status.status, 404)
  })

  // ---- Browser guest pages -------------------------------------------------

  test('the create page carries the verification and lookup URLs', async ({ assert }) => {
    const page = await new InertiaClient(running.baseUrl).visit('GET', `${GUEST}/create`)
    assert.equal(page.status, 200, JSON.stringify(page.body).slice(0, 300))
    assert.equal(page.body.props.verification_url, '/support/guest/verification')
    assert.equal(page.body.props.lookup_url, '/support/guest/lookup')
  })

  test('the guest form needs proof and redirects to a private grant URL', async ({ assert }) => {
    const client = new InertiaClient(running.baseUrl)
    const address = email()
    const form = {
      guest_name: 'Grace',
      guest_email: address,
      subject: 'Browser ticket',
      description: 'From the guest form',
    }

    const refused = await client.visit('POST', GUEST, { data: form, referer: `${GUEST}/create` })
    assert.equal(refused.status, 302)
    assert.equal(refused.location, `${GUEST}/create`)
    const { default: Ticket } = await import('../../src/models/ticket.js')
    assert.isNull(await Ticket.query().where('guest_email', address).first())

    const created = await client.visit('POST', GUEST, {
      data: { ...form, ...(await guestProof(address, 'ticket')) },
      referer: `${GUEST}/create`,
    })
    assert.equal(created.status, 302, JSON.stringify(created.body))
    const grant = created.location!.slice(`${GUEST}/`.length)
    assert.match(grant, /^[A-Za-z0-9_-]{20,}$/)

    const page = await client.visit('GET', created.location!)
    assert.equal(page.status, 200, JSON.stringify(page.body).slice(0, 300))
    assert.equal(page.body.props.ticket.subject, 'Browser ticket')
    assert.equal(page.body.props.token, grant)
    for (const key of ['metadata', 'guest_token', 'guest_access_hash', 'guest_verified_email']) {
      assert.notProperty(page.body.props.ticket, key)
    }
    assert.equal(page.headers.get('cache-control'), 'no-store, private')
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer')

    const reply = await client.visit('POST', `${created.location}/reply`, {
      data: { body: 'Any news?' },
      referer: created.location!,
    })
    assert.equal(reply.status, 302)
    const ticket = await Ticket.query().where('guest_email', address).firstOrFail()
    const replies = await running.db.from('escalated_replies').where('ticket_id', ticket.id)
    assert.lengthOf(replies, 1)
  })

  test('a permanent guest token opens nothing unless legacy tokens are on', async ({ assert }) => {
    const { randomBytes } = await import('node:crypto')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const token = randomBytes(32).toString('hex')
    await Ticket.create({
      reference: `LEGACY-${Date.now()}`,
      requesterType: null,
      requesterId: null,
      guestName: 'Old guest',
      guestEmail: email('legacy'),
      guestToken: token,
      subject: 'Before verification',
      description: 'Opened by an earlier release',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)

    const client = new InertiaClient(running.baseUrl)
    assert.equal(await visitStatus(client, 'GET', `${GUEST}/${token}`), 404)
    assert.equal(await statusOf('GET', `${WIDGET}/tickets/${token}`), 404)

    const config = getConfig() as any
    config.guestAccess = { ...config.guestAccess, legacyTokens: true }
    assert.equal(await visitStatus(client, 'GET', `${GUEST}/${token}`), 200)
    assert.equal(await statusOf('GET', `${WIDGET}/tickets/${token}`), 200)
  })

  // ---- Live chat -----------------------------------------------------------

  test('a widget chat needs a chat code for the email', async ({ assert }) => {
    const address = email()
    const body = { name: 'Chatty', email: address, message: '' }
    const missing = await json('POST', `${WIDGET}/chat/start`, body)
    assert.equal(missing.status, 422, missing.text)

    const ticketProof = await guestProof(address, 'ticket')
    const wrong = await json('POST', `${WIDGET}/chat/start`, { ...body, ...ticketProof })
    assert.equal(wrong.status, 422)

    const started = await json('POST', `${WIDGET}/chat/start`, {
      ...body,
      ...(await guestProof(address, 'chat')),
    })
    assert.equal(started.status, 201, started.text)
    assert.isString(started.data.id)
  })

  test('the code is emailed only to the address asked for', async ({ assert }) => {
    const before = sentCodes.length
    const address = email()
    await json('POST', `${WIDGET}/verification`, {
      email: ` ${address.toUpperCase()} `,
      purpose: 'chat',
    })
    assert.equal(sentCodes.length, before + 1)
    assert.equal(sentCodes[sentCodes.length - 1].email, address)
  })
})
