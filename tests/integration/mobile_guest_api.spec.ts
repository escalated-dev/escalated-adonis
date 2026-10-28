import { test } from '@japa/runner'
import { RouterFactory } from '@adonisjs/core/factories/http'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { guestProof } from './fixtures/guest_codes.js'
import { MemoryGuestRateLimitStore } from '../../src/support/guest_rate_limit.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| Mobile guest API
|--------------------------------------------------------------------------
|
| The JSON routes a mobile app uses to let a guest file, read and reply to a
| ticket, under the REST API prefix plus `/mobile`. They reuse verified guest
| access: the same codes, grants and guest rate limits as the browser and
| widget surfaces. Contract:
| https://github.com/escalated-dev/escalated-developer-context/blob/main/domain-model/mobile-guest-api.md
|
*/

const MOBILE = '/support/api/v1/mobile/guest'
const GUEST = '/support/guest'
const WIDGET = '/support/widget'

test.group('Mobile guest API', (group) => {
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
  function email(label = 'mobile') {
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

  function ticketBody(address: string, extra: Record<string, unknown> = {}) {
    return {
      name: 'Mo Bile',
      email: address,
      subject: 'App question',
      description: 'Sent from the app.',
      ...extra,
    }
  }

  async function createMobileTicket(address = email()) {
    const created = await json(
      'POST',
      `${MOBILE}/tickets`,
      ticketBody(address, await guestProof(address, 'ticket'))
    )
    if (created.status !== 201) throw new Error(`mobile ticket: ${created.status} ${created.text}`)
    return { ...created.data.data, email: address }
  }

  async function ticketByReference(reference: string) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.findByOrFail('reference', reference)
  }

  function assertPrivate(assert: any, headers: Headers) {
    assert.equal(headers.get('cache-control'), 'no-store, private')
    assert.equal(headers.get('referrer-policy'), 'no-referrer')
  }

  // ---- Verification and lookup --------------------------------------------

  test('verification answers 202 with the same shape as the other surfaces', async ({ assert }) => {
    const response = await json('POST', `${MOBILE}/verification`, {
      email: email(),
      purpose: 'ticket',
    })
    assert.equal(response.status, 202, response.text)
    assert.isString(response.data.verification_id)
    assert.equal(response.data.expires_in, 600)
    assert.equal(response.data.message, 'Check your email for a verification code.')
    assertPrivate(assert, response.headers)
    assert.isString(response.headers.get('x-ratelimit-limit'))
    assert.isString(response.headers.get('x-ratelimit-remaining'))

    const bad = await json('POST', `${MOBILE}/verification`, { email: 'nope', purpose: 'admin' })
    assert.equal(bad.status, 422)
    assert.property(bad.data.errors, 'email')
    assert.property(bad.data.errors, 'purpose')
    assertPrivate(assert, bad.headers)

    await setting('guest_tickets_enabled', '0')
    const off = await json('POST', `${MOBILE}/verification`, { email: email(), purpose: 'lookup' })
    assert.equal(off.status, 403)
    assertPrivate(assert, off.headers)
  })

  test('lookup issues a fresh grant, revokes the old one and spends the code', async ({
    assert,
  }) => {
    const created = await createMobileTicket()
    const proof = await guestProof(created.email, 'lookup')
    const found = await json('POST', `${MOBILE}/lookup`, {
      email: created.email.toUpperCase(),
      reference: created.reference,
      ...proof,
    })
    assert.equal(found.status, 200, found.text)
    assert.lengthOf(found.data.data, 1)
    const match = found.data.data[0]
    assert.deepEqual(Object.keys(match).sort(), [
      'expires_at',
      'guest_access_token',
      'reference',
      'subject',
    ])
    assertPrivate(assert, found.headers)

    assert.equal(await statusOf('GET', `${MOBILE}/tickets/${created.guest_access_token}`), 404)
    assert.equal(await statusOf('GET', `${MOBILE}/tickets/${match.guest_access_token}`), 200)

    const reused = await json('POST', `${MOBILE}/lookup`, {
      email: created.email,
      reference: created.reference,
      ...proof,
    })
    assert.equal(reused.status, 422)
    assert.property(reused.data.errors, 'verification_code')
  })

  // ---- Create --------------------------------------------------------------

  test('create without proof is 422 and creates no contact or ticket', async ({ assert }) => {
    const address = email()
    const missing = await json('POST', `${MOBILE}/tickets`, ticketBody(address))
    assert.equal(missing.status, 422, missing.text)
    assert.property(missing.data.errors, 'verification_id')
    assert.property(missing.data.errors, 'verification_code')
    assertPrivate(assert, missing.headers)

    const wrong = await json(
      'POST',
      `${MOBILE}/tickets`,
      ticketBody(address, {
        ...(await guestProof(address, 'ticket')),
        verification_code: '00000000',
      })
    )
    assert.equal(wrong.status, 422)
    assert.property(wrong.data.errors, 'verification_code')

    const chat = await json(
      'POST',
      `${MOBILE}/tickets`,
      ticketBody(address, await guestProof(address, 'chat'))
    )
    assert.equal(chat.status, 422)

    const { default: Ticket } = await import('../../src/models/ticket.js')
    const { default: Contact } = await import('../../src/models/contact.js')
    assert.isNull(await Ticket.query().where('guest_email', address).first())
    assert.isNull(await Contact.query().where('email', address).first())
  })

  test('create validates its fields before checking the proof', async ({ assert }) => {
    const address = email()
    const proof = await guestProof(address, 'ticket')
    const invalid = await json('POST', `${MOBILE}/tickets`, {
      email: 'not-an-email',
      subject: 'x'.repeat(256),
      priority: 'whenever',
      department_id: 999999,
      verification_id: 'not-a-uuid',
      verification_code: '1'.repeat(17),
    })
    assert.equal(invalid.status, 422, invalid.text)
    for (const field of [
      'name',
      'email',
      'subject',
      'description',
      'priority',
      'department_id',
      'verification_id',
      'verification_code',
    ]) {
      assert.property(invalid.data.errors, field)
    }
    // The proof was not touched, so it still works.
    const created = await json('POST', `${MOBILE}/tickets`, ticketBody(address, proof))
    assert.equal(created.status, 201, created.text)
  })

  test('create is 403 while guest tickets are off', async ({ assert }) => {
    await setting('guest_tickets_enabled', '0')
    const address = email()
    const response = await json('POST', `${MOBILE}/tickets`, ticketBody(address))
    assert.equal(response.status, 403)
    assert.deepEqual(response.data, { message: 'Guest tickets are not enabled.' })
  })

  test('verification then create answers 201 with a grant; the code is single use', async ({
    assert,
  }) => {
    const address = email()
    const verification = await json('POST', `${MOBILE}/verification`, {
      email: address,
      purpose: 'ticket',
    })
    assert.equal(verification.status, 202)
    const { latestCode } = await import('./fixtures/guest_codes.js')
    const proof = {
      verification_id: verification.data.verification_id,
      verification_code: latestCode(address),
    }

    const created = await json(
      'POST',
      `${MOBILE}/tickets`,
      ticketBody(` ${address.toUpperCase()} `, {
        ...proof,
        priority: 'high',
        external_reference: 'EXT-1',
        metadata: { secret: true },
        status: 'closed',
        assigned_to: 1,
      })
    )
    assert.equal(created.status, 201, created.text)
    assert.equal(created.data.message, 'Ticket created.')
    assertPrivate(assert, created.headers)
    const data = created.data.data
    assert.isString(data.guest_access_token)
    assert.isString(data.guest_access_expires_at)
    assert.deepEqual(data.status, { value: 'open', label: 'Open' })
    assert.deepEqual(data.priority, { value: 'high', label: 'High' })
    assert.equal(data.channel, 'web')
    assert.deepEqual(data.metadata, {})
    assert.deepEqual(data.requester, { name: 'Mo Bile', email: address })
    assert.isNull(data.assignee)
    assert.deepEqual(data.replies, [])
    assert.deepEqual(data.tags, [])
    assert.deepEqual(data.activities, [])
    assert.isFalse(data.is_following)
    assert.equal(data.followers_count, 0)
    assert.deepEqual(Object.keys(data.sla).sort(), [
      'first_response_at',
      'first_response_breached',
      'first_response_due_at',
      'resolution_breached',
      'resolution_due_at',
    ])
    for (const key of ['external_reference', 'chat_metadata', 'guest_token', 'guest_email']) {
      assert.notProperty(data, key)
    }

    const ticket = await ticketByReference(data.reference)
    assert.equal(ticket.guestEmail, address)
    assert.equal(ticket.guestName, 'Mo Bile')
    assert.isNotNull(ticket.guestEmailVerifiedAt)
    assert.isNull(ticket.metadata)
    assert.equal(ticket.status, 'open')
    assert.isNull(ticket.assignedTo)

    const again = await json(
      'POST',
      `${MOBILE}/tickets`,
      ticketBody(address, { ...proof, subject: 'Again' })
    )
    assert.equal(again.status, 422)
    assert.property(again.data.errors, 'verification_code')
  })

  // ---- Grants ---------------------------------------------------------------

  test('the grant opens GET here and on the browser and widget guest routes', async ({
    assert,
  }) => {
    const created = await createMobileTicket()
    const shown = await json('GET', `${MOBILE}/tickets/${created.guest_access_token}`)
    assert.equal(shown.status, 200, shown.text)
    assert.equal(shown.data.data.reference, created.reference)
    assert.equal(shown.data.data.guest_access_token, created.guest_access_token)
    assert.isString(shown.data.data.guest_access_expires_at)
    assertPrivate(assert, shown.headers)

    const widget = await json('GET', `${WIDGET}/tickets/${created.reference}`, null, {
      Authorization: `Bearer ${created.guest_access_token}`,
    })
    assert.equal(widget.status, 200, widget.text)

    const page = await new InertiaClient(running.baseUrl).visit(
      'GET',
      `${GUEST}/${created.guest_access_token}`
    )
    assert.equal(page.status, 200)

    // And a widget grant opens the mobile route.
    const address = email()
    const fromWidget = await json('POST', `${WIDGET}/tickets`, {
      ...ticketBody(address),
      ...(await guestProof(address, 'ticket')),
    })
    assert.equal(fromWidget.status, 201, fromWidget.text)
    const mobile = await json('GET', `${MOBILE}/tickets/${fromWidget.data.guest_access_token}`)
    assert.equal(mobile.status, 200, mobile.text)
    assert.equal(mobile.data.data.reference, fromWidget.data.reference)
  })

  test('an expired, malformed, over-long or chat grant is 404', async ({ assert }) => {
    const created = await createMobileTicket()
    const ticket = await ticketByReference(created.reference)
    await running.db
      .from('escalated_tickets')
      .where('id', ticket.id)
      .update({ guest_access_expires_at: '2000-01-01 00:00:00' })
    const expired = await json('GET', `${MOBILE}/tickets/${created.guest_access_token}`)
    assert.equal(expired.status, 404)
    assertPrivate(assert, expired.headers)
    const expiredReply = await json(
      'POST',
      `${MOBILE}/tickets/${created.guest_access_token}/replies`,
      { email: created.email, body: 'Hello?' }
    )
    assert.equal(expiredReply.status, 404)

    assert.equal(await statusOf('GET', `${MOBILE}/tickets/not-a-grant`), 404)
    assert.equal(await statusOf('GET', `${MOBILE}/tickets/${'a'.repeat(5000)}`), 404)

    const address = email()
    const chat = await json('POST', `${WIDGET}/chat/start`, {
      name: 'Chatty',
      email: address,
      message: '',
      ...(await guestProof(address, 'chat')),
    })
    assert.equal(chat.status, 201, chat.text)
    assert.equal(await statusOf('GET', `${MOBILE}/tickets/${chat.data.id}`), 404)
  })

  // ---- Show -----------------------------------------------------------------

  test('show lists public replies newest first and never an internal note', async ({ assert }) => {
    const created = await createMobileTicket()
    const ticket = await ticketByReference(created.reference)
    const { default: Reply } = await import('../../src/models/reply.js')
    const rows: Array<[string, string | null, boolean, boolean, string]> = [
      ['Guest first', null, false, false, '2026-01-01 10:00:00'],
      ['Staff only secret', 'User', true, false, '2026-01-01 10:01:00'],
      ['Agent answer', 'User', false, true, '2026-01-01 10:02:00'],
    ]
    for (const [body, authorType, isInternalNote, isPinned, at] of rows) {
      const reply = await Reply.create({
        ticketId: ticket.id,
        authorType,
        authorId: authorType ? '999999' : null,
        body,
        isInternalNote,
        isPinned,
        type: isInternalNote ? 'note' : 'reply',
      } as any)
      await running.db.from('escalated_replies').where('id', reply.id).update({ created_at: at })
    }

    const shown = await json('GET', `${MOBILE}/tickets/${created.guest_access_token}`)
    assert.equal(shown.status, 200, shown.text)
    assert.notInclude(shown.text, 'Staff only secret')
    const replies = shown.data.data.replies
    assert.deepEqual(
      replies.map((reply: any) => reply.body),
      ['Agent answer', 'Guest first']
    )
    assert.deepEqual(replies[0].author, { id: 0, name: 'Support', email: '' })
    assert.isTrue(replies[0].is_pinned)
    assert.isFalse(replies[0].is_internal_note)
    assert.deepEqual(replies[1].author, { id: 0, name: 'Mo Bile', email: created.email })
    assert.deepEqual(replies[1].attachments, [])
    assert.isString(replies[1].created_at)
  })

  // ---- Replies --------------------------------------------------------------

  test('a reply checks the grant, the closed state, the fields and the email', async ({
    assert,
  }) => {
    const created = await createMobileTicket()
    const path = `${MOBILE}/tickets/${created.guest_access_token}/replies`

    const invalid = await json('POST', path, { email: 'nope' })
    assert.equal(invalid.status, 422)
    assert.property(invalid.data.errors, 'body')
    assert.property(invalid.data.errors, 'email')

    const mismatch = await json('POST', path, { email: email('other'), body: 'Hi' })
    assert.equal(mismatch.status, 403)
    assert.deepEqual(mismatch.data, { message: 'The provided email does not match this ticket.' })
    assertPrivate(assert, mismatch.headers)

    const sent = await json('POST', path, {
      email: ` ${created.email.toUpperCase()} `,
      body: 'Any news?',
    })
    assert.equal(sent.status, 201, sent.text)
    assert.deepEqual(sent.data, { message: 'Reply sent.' })
    assertPrivate(assert, sent.headers)

    const ticket = await ticketByReference(created.reference)
    const rows = await running.db.from('escalated_replies').where('ticket_id', ticket.id)
    assert.lengthOf(rows, 1)
    assert.isNull(rows[0].author_type)
    assert.isNull(rows[0].author_id)
    assert.notOk(rows[0].is_internal_note)

    ticket.status = 'closed'
    await ticket.save()
    const closed = await json('POST', path, { email: created.email, body: 'Reopen?' })
    assert.equal(closed.status, 422)
    assert.deepEqual(closed.data, { message: 'This ticket is closed.' })
  })

  test('reply attachments get guest download links on show', async ({ assert }) => {
    const created = await createMobileTicket()
    const form = new FormData()
    form.append('email', created.email)
    form.append('body', 'With a file')
    form.append(
      'attachments[]',
      new Blob(['%PDF-1.4 mobile'], { type: 'application/pdf' }),
      'm.pdf'
    )
    const sent = await fetch(
      `${running.baseUrl}${MOBILE}/tickets/${created.guest_access_token}/replies`,
      { method: 'POST', headers: { Accept: 'application/json' }, body: form }
    )
    assert.equal(sent.status, 201, await sent.text())

    const shown = await json('GET', `${MOBILE}/tickets/${created.guest_access_token}`)
    const attachment = shown.data.data.replies[0].attachments[0]
    assert.equal(attachment.filename, 'm.pdf')
    assert.equal(attachment.mime_type, 'application/pdf')
    assert.isNumber(attachment.size)
    assert.isNumber(attachment.id)
    assert.match(attachment.url, /\/support\/attachments\/\d+\/download\?token=/)
    const download = await fetch(running.baseUrl + attachment.url)
    assert.equal(download.status, 200)
    assert.equal(await download.text(), '%PDF-1.4 mobile')
  })

  // ---- Rate limits ------------------------------------------------------------

  test('the guest buckets are shared with the other surfaces and answer 429', async ({
    assert,
  }) => {
    const config = getConfig() as any
    config.guestRateLimit = { store: new MemoryGuestRateLimitStore(), ticketsPerMinute: 2 }
    const browser = await json('POST', `${GUEST}/verification`, {
      email: email(),
      purpose: 'ticket',
    })
    assert.equal(browser.status, 202)
    const first = await json('POST', `${MOBILE}/verification`, {
      email: email(),
      purpose: 'ticket',
    })
    assert.equal(first.status, 202)
    const limited = await json('POST', `${MOBILE}/tickets`, ticketBody(email()))
    assert.equal(limited.status, 429)
    assert.isAbove(Number(limited.headers.get('retry-after')), 0)
    assertPrivate(assert, limited.headers)
  })

  test('the reply bucket covers lookup and replies', async ({ assert }) => {
    const created = await createMobileTicket()
    const config = getConfig() as any
    config.guestRateLimit = { store: new MemoryGuestRateLimitStore(), repliesPerMinute: 1 }
    const path = `${MOBILE}/tickets/${created.guest_access_token}/replies`
    assert.equal(await statusOf('POST', path, { email: created.email, body: 'One' }), 201)
    const limited = await json('POST', `${MOBILE}/lookup`, {
      email: created.email,
      reference: created.reference,
    })
    assert.equal(limited.status, 429)
    assert.isAbove(Number(limited.headers.get('retry-after')), 0)
  })

  // ---- Registration -----------------------------------------------------------

  test('the routes exist only while the REST API is enabled', async ({ assert }) => {
    const { registerMobileGuestRoutes } = await import('../../start/routes.js')
    const paths: Array<[string, string]> = [
      ['POST', '/support/api/v1/mobile/guest/verification'],
      ['POST', '/support/api/v1/mobile/guest/lookup'],
      ['POST', '/support/api/v1/mobile/guest/tickets'],
      ['GET', '/support/api/v1/mobile/guest/tickets/abc'],
      ['POST', '/support/api/v1/mobile/guest/tickets/abc/replies'],
    ]

    const disabled = new RouterFactory().create()
    registerMobileGuestRoutes({ api: { enabled: false } }, disabled)
    disabled.commit()
    for (const [method, path] of paths) assert.isNull(disabled.match(path, method), path)

    const enabled = new RouterFactory().create()
    registerMobileGuestRoutes({ api: { enabled: true, prefix: 'support/api/v1' } }, enabled)
    enabled.commit()
    for (const [method, path] of paths) assert.isNotNull(enabled.match(path, method), path)
  })
})
