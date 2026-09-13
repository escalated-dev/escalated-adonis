import { test } from '@japa/runner'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Outbound webhook destinations
|--------------------------------------------------------------------------
|
| Admin webhooks only had to match ^https?://, and deliveries POSTed to
| whatever that was: the server's own loopback interface, the private network,
| a cloud metadata endpoint. The delivery log then showed the response body.
| A workflow's send_webhook action had the same gap.
|
| The destination is now checked when a webhook is saved and again before
| every delivery, since a name can resolve somewhere else later. A local HTTP
| server stands in for an internal service: it must never be reached unless the
| host opts in to private destinations.
|
*/

test.group('Outbound webhook destinations', (group) => {
  let running: TestApp
  let internal: Server
  let internalUrl: string
  let received: string[] = []

  group.setup(async () => {
    running = await testApp()

    internal = createServer((req, res) => {
      received.push(`${req.method} ${req.url}`)
      req.resume()
      req.on('end', () => res.end('internal response'))
    })
    await new Promise<void>((resolve) => internal.listen(0, '127.0.0.1', resolve))
    internalUrl = `http://127.0.0.1:${(internal.address() as AddressInfo).port}`

    return () => new Promise<void>((resolve) => internal.close(() => resolve()))
  })

  group.each.setup(async () => {
    received = []
    await running.db.from('escalated_webhook_deliveries').delete()
    await running.db.from('escalated_webhooks').delete()
    await running.db.from('escalated_workflow_logs').delete()
    await running.db.from('escalated_workflows').delete()
  })

  group.each.timeout(30_000)

  function admin() {
    return new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
  }

  async function withWebhookConfig<T>(
    webhooks: Record<string, unknown>,
    callback: () => Promise<T>
  ) {
    const config = (globalThis as any).__escalated_config
    const previous = config.webhooks
    config.webhooks = webhooks
    try {
      return await callback()
    } finally {
      config.webhooks = previous
    }
  }

  async function storedWebhook(url: string) {
    const { default: Webhook } = await import('../../src/models/webhook.js')
    return Webhook.create({ url, events: ['ticket.created'], active: true, secret: null })
  }

  // ---- Saving ----------------------------------------------------------------

  test('saving a webhook refuses loopback, private and link-local destinations', async ({
    assert,
  }) => {
    for (const url of [
      `${internalUrl}/hook`,
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.8/hook',
      'http://[::1]/hook',
    ]) {
      const client = admin()

      const visit = await client.visit('POST', '/support/admin/webhooks', {
        data: { url, events: ['ticket.created'], active: true },
        referer: '/support/admin/webhooks',
      })
      assert.equal(visit.status, 302, url)

      const page = await client.visit('GET', '/support/admin/webhooks')
      assert.isString(page.body.flash.error, `no error flashed for ${url}`)
    }

    assert.lengthOf(await running.db.from('escalated_webhooks'), 0)
  })

  test('saving a webhook still accepts a public destination', async ({ assert }) => {
    const client = admin()

    await client.visit('POST', '/support/admin/webhooks', {
      data: { url: 'https://93.184.216.34/escalated', events: ['ticket.created'], active: true },
      referer: '/support/admin/webhooks',
    })

    const rows = await running.db.from('escalated_webhooks')
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].url, 'https://93.184.216.34/escalated')
  })

  test('updating a webhook refuses a private destination and keeps the old one', async ({
    assert,
  }) => {
    const webhook = await running.db
      .table('escalated_webhooks')
      .insert({
        url: 'https://93.184.216.34/escalated',
        events: JSON.stringify(['ticket.created']),
        active: true,
        created_at: sqlTimestamp(),
        updated_at: sqlTimestamp(),
      })
      .returning('id')
    const id = typeof webhook[0] === 'object' ? webhook[0].id : webhook[0]

    await admin().visit('PUT', `/support/admin/webhooks/${id}`, {
      data: { url: `${internalUrl}/hook`, events: ['ticket.created'], active: true },
      referer: '/support/admin/webhooks',
    })

    const row = await running.db.from('escalated_webhooks').where('id', id).first()
    assert.equal(row.url, 'https://93.184.216.34/escalated')
  })

  // ---- Sending ---------------------------------------------------------------

  test('a stored webhook with a private destination is never called', async ({ assert }) => {
    const { default: WebhookDispatcher } = await import('../../src/services/webhook_dispatcher.js')
    const webhook = await storedWebhook(`${internalUrl}/hook`)

    await new WebhookDispatcher().dispatch('ticket.created', { ticket: { id: 1 } })

    assert.deepEqual(received, [])
    const deliveries = await running.db
      .from('escalated_webhook_deliveries')
      .where('webhook_id', webhook.id)
    assert.lengthOf(deliveries, 1)
    assert.equal(deliveries[0].response_code, 0)
    assert.match(deliveries[0].response_body, /non-public/)
  })

  test('a private destination is called when the host allows private webhook URLs', async ({
    assert,
  }) => {
    const { default: WebhookDispatcher } = await import('../../src/services/webhook_dispatcher.js')
    const webhook = await storedWebhook(`${internalUrl}/hook`)

    await withWebhookConfig({ allowPrivateUrls: true }, () =>
      new WebhookDispatcher().dispatch('ticket.created', { ticket: { id: 1 } })
    )

    assert.deepEqual(received, ['POST /hook'])
    const delivery = await running.db
      .from('escalated_webhook_deliveries')
      .where('webhook_id', webhook.id)
      .first()
    assert.equal(delivery.response_code, 200)
  })

  test('a workflow send_webhook action never calls a private destination', async ({ assert }) => {
    await running.db.table('escalated_workflows').insert({
      name: 'Call an internal URL',
      trigger_event: 'ticket.created',
      conditions: JSON.stringify({ all: [] }),
      actions: JSON.stringify([{ type: 'send_webhook', value: `${internalUrl}/workflow` }]),
      is_active: true,
      position: 0,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })

    const { default: Ticket } = await import('../../src/models/ticket.js')
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    const ticket = await Ticket.create({
      reference: `SSRF-${Date.now()}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject: 'Workflow webhook destination',
      description: 'Opened by the webhook destination tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)

    await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })

    assert.deepEqual(received, [])
  })
})
