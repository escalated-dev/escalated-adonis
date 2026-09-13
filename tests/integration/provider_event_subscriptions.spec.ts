import { test } from '@japa/runner'
import { testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Provider event subscriptions
|--------------------------------------------------------------------------
|
| The provider subscribes outbound webhooks, the plugin bridge and the
| custom-action audit note to package events during boot(). It took the
| emitter from `@adonisjs/core/services/emitter`, whose export is only assigned
| once the application has booted: during boot() it is undefined, the
| subscription threw, and a bare `catch {}` swallowed it. So no event ever
| reached a webhook, and no custom action left its note.
|
| These tests emit the events the way the package's services do and look for
| what each subscription should leave behind.
|
*/

test.group('Provider event subscriptions', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  let sequence = 0

  async function openTicket(subject: string) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `EVENTS-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject,
      description: 'Opened by the provider event subscription tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  async function events() {
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    return { emitter, ESCALATED_EVENTS }
  }

  test('a triggered custom action leaves an internal note on the ticket', async ({ assert }) => {
    const { emitter, ESCALATED_EVENTS } = await events()
    const ticket = await openTicket('Custom action')

    await emitter.emit(ESCALATED_EVENTS.TICKET_CUSTOM_ACTION_TRIGGERED, {
      ticket,
      action: 'refund',
      user: TEST_USERS.agent,
    })

    const notes = await running.db
      .from('escalated_replies')
      .where('ticket_id', ticket.id)
      .where('is_internal_note', true)
    assert.lengthOf(notes, 1)
    assert.equal(notes[0].body, 'Custom action "refund" was triggered.')
  })

  test('a package event reaches the webhooks subscribed to it', async ({ assert, cleanup }) => {
    const { emitter, ESCALATED_EVENTS } = await events()
    const { default: Webhook } = await import('../../src/models/webhook.js')

    // `.invalid` never resolves, so no request leaves the machine. The attempt is
    // still recorded in the delivery log, which is what shows the event arrived.
    const webhook = await Webhook.create({
      url: 'http://escalated-events-test.invalid/hook',
      events: ['ticket.created'],
      active: true,
      secret: null,
    })
    cleanup(async () => {
      await running.db.from('escalated_webhook_deliveries').where('webhook_id', webhook.id).delete()
      await running.db.from('escalated_webhooks').where('id', webhook.id).delete()
    })

    const ticket = await openTicket('Webhook event')
    await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })

    // Webhook dispatch is not awaited by the event, so wait for the attempt.
    let deliveries: Array<{ event: string }> = []
    for (let attempt = 0; attempt < 50 && deliveries.length === 0; attempt++) {
      deliveries = await running.db
        .from('escalated_webhook_deliveries')
        .where('webhook_id', webhook.id)
      if (deliveries.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    assert.isAtLeast(deliveries.length, 1, 'no delivery was attempted for ticket.created')
    assert.equal(deliveries[0].event, 'ticket.created')
  })
})
