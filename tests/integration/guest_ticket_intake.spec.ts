import { test } from '@japa/runner'
import { withGuestProof } from './fixtures/guest_codes.js'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { MemoryGuestRateLimitStore } from '../../src/support/guest_rate_limit.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| Guest ticket intake: the widget and the guest form
|--------------------------------------------------------------------------
|
| The widget's POST /widget/tickets created its ticket with Ticket.create(),
| apart from every other intake path. It ignored the admin's "guest tickets"
| switch, emitted no TICKET_CREATED (so no notifications, webhooks, workflows
| or plugin hooks ran) and attached no SLA. Laravel's WidgetController
| refuses with 403 when guest tickets are off and creates through
| GuestTicketService. Both paths here now go through TicketService.createGuest.
|
| Laravel also requires mailbox verification on the widget; this package has
| no guest verification yet, so that step is not enforced.
|
| The "guest_user" guest policy stored the config's import path
| ('#models/user') as requester_type and int-parsed the user key, which
| dropped UUID keys and read "12abc" as user 12.
|
*/

const WIDGET = '/support/widget'

test.group('Guest ticket intake', (group) => {
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
      sla: config.sla,
      userModel: config.userModel,
    }
    config.guestRateLimit = { store: new MemoryGuestRateLimitStore() }
    return async () => {
      Object.assign(config, previous)
      await setting('widget_enabled', '1')
      await setting('guest_tickets_enabled', '1')
      await setting('guest_policy_mode', 'unassigned')
      await setting('guest_policy_user_id', '')
    }
  })

  async function setting(key: string, value: string) {
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set(key, value)
  }

  let sequence = 0
  function unique(label: string) {
    return `${label}-${++sequence}-${Date.now()}`
  }

  async function widgetTicket(body: Record<string, unknown> = {}) {
    const payload = await withGuestProof('POST', WIDGET + '/tickets', {
      name: 'Jane Doe',
      email: `${unique('jane')}@example.com`,
      subject: unique('Where is my order?'),
      description: 'It has not arrived yet.',
      department_id: null,
      ...body,
    })
    const response = await fetch(running.baseUrl + WIDGET + '/tickets', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    let data: any = text
    try {
      data = JSON.parse(text)
    } catch {}
    return { status: response.status, data, text }
  }

  async function ticketByReference(reference: string) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.query().where('reference', reference).firstOrFail()
  }

  async function captureCreated<T>(run: () => Promise<T>) {
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    const created: any[] = []
    const listener = (payload: any) => {
      created.push(payload.ticket)
    }
    emitter.on(ESCALATED_EVENTS.TICKET_CREATED, listener)
    try {
      const result = await run()
      return { result, created }
    } finally {
      emitter.off(ESCALATED_EVENTS.TICKET_CREATED, listener)
    }
  }

  // ---- Widget ----------------------------------------------------------------

  test('the widget refuses a ticket with 403 when guest tickets are switched off', async ({
    assert,
  }) => {
    await setting('guest_tickets_enabled', '0')
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const subject = unique('Disabled')

    const response = await widgetTicket({ subject })

    assert.equal(response.status, 403, response.text)
    assert.isString(response.data.message)
    assert.isNull(await Ticket.query().where('subject', subject).first())
  })

  test('the widget answers 403 when the widget is switched off', async ({ assert }) => {
    await setting('widget_enabled', '0')

    const response = await widgetTicket()

    assert.equal(response.status, 403, response.text)
  })

  test('a widget ticket emits TICKET_CREATED', async ({ assert }) => {
    const { result: response, created } = await captureCreated(() => widgetTicket())

    assert.equal(response.status, 201, response.text)
    assert.lengthOf(created, 1)
    assert.equal(created[0].reference, response.data.reference)
    const ticket = await ticketByReference(response.data.reference)
    assert.equal(ticket.channel, 'widget')
    assert.equal(ticket.metadata?.source, 'widget')
    assert.isNotNull(ticket.contactId)
  })

  test('a widget ticket gets the default SLA policy when SLAs are on', async ({ assert }) => {
    ;(getConfig() as any).sla = { enabled: true }
    const { default: SlaPolicy } = await import('../../src/models/sla_policy.js')
    const policy = await SlaPolicy.create({
      name: unique('Default SLA'),
      description: null,
      departmentId: null,
      ticketType: null,
      isDefault: true,
      firstResponseHours: { low: 24, medium: 8, high: 4, urgent: 1, critical: 1 },
      resolutionHours: { low: 72, medium: 48, high: 24, urgent: 8, critical: 4 },
      businessHoursOnly: false,
      isActive: true,
    } as any)

    try {
      const response = await widgetTicket()
      assert.equal(response.status, 201, response.text)
      const ticket = await ticketByReference(response.data.reference)
      assert.isNotNull(ticket.slaPolicyId)
      assert.isNotNull(ticket.firstResponseDueAt)
    } finally {
      await policy.delete()
    }
  })

  test('the widget refuses an invalid email or an oversized field', async ({ assert }) => {
    for (const body of [
      { email: 'not-an-email' },
      { subject: 'x'.repeat(256) },
      { description: 'x'.repeat(5001) },
      { name: 'x'.repeat(256) },
    ]) {
      const response = await widgetTicket(body)
      assert.equal(response.status, 400, `${JSON.stringify(Object.keys(body))}: ${response.text}`)
      assert.isString(response.data.message)
    }
  })

  // ---- Guest form ------------------------------------------------------------

  test('a guest form ticket emits TICKET_CREATED once', async ({ assert }) => {
    const subject = unique('Guest form')
    const data = await withGuestProof('POST', '/support/guest', {
      guest_name: 'Gus Guest',
      guest_email: `${unique('gus')}@example.com`,
      subject,
      description: 'Sent from the guest form.',
    })
    const { result: visit, created } = await captureCreated(() =>
      new InertiaClient(running.baseUrl).visit('POST', '/support/guest', {
        data,
        referer: '/support/guest/create',
      })
    )

    assert.oneOf(visit.status, [302, 303], JSON.stringify(visit.body))
    assert.lengthOf(created, 1)
    assert.equal(created[0].subject, subject)
    // The guest ticket route accepts only [A-Za-z0-9]{64} tokens.
    assert.match(String(visit.location), /\/support\/guest\/[A-Za-z0-9_-]{20,}$/)
  })

  // ---- Guest policy ----------------------------------------------------------

  test('guest_user policy records the model class name and the user key', async ({ assert }) => {
    await setting('guest_policy_mode', 'guest_user')
    await setting('guest_policy_user_id', '3')

    const response = await widgetTicket()

    assert.equal(response.status, 201, response.text)
    const ticket = await ticketByReference(response.data.reference)
    assert.equal(ticket.requesterType, 'User')
    assert.equal(String(ticket.requesterId), '3')
  })

  test('guest_user policy keeps a UUID user key', async ({ assert }) => {
    const uuid = '0b7c2a8e-5d1f-4c3a-9e6b-2f4d8a1c7e90'
    class GuestAccount {
      constructor(public id: string) {}
      static async find(id: string) {
        return id === uuid ? new GuestAccount(uuid) : null
      }
    }
    ;(getConfig() as any).userModel = GuestAccount
    await setting('guest_policy_mode', 'guest_user')
    await setting('guest_policy_user_id', uuid)

    const response = await widgetTicket()

    assert.equal(response.status, 201, response.text)
    const ticket = await ticketByReference(response.data.reference)
    assert.equal(ticket.requesterType, 'GuestAccount')
    assert.equal(String(ticket.requesterId), uuid)
  })

  test('guest_user policy falls back to unassigned for a key that names no user', async ({
    assert,
  }) => {
    await setting('guest_policy_mode', 'guest_user')

    for (const raw of ['3abc', '999999', '']) {
      await setting('guest_policy_user_id', raw)
      const response = await widgetTicket()
      assert.equal(response.status, 201, response.text)
      const ticket = await ticketByReference(response.data.reference)
      assert.isNull(ticket.requesterType, `guest_policy_user_id "${raw}"`)
      assert.isNull(ticket.requesterId, `guest_policy_user_id "${raw}"`)
    }
  })
})
