import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Webhook admin pages
|--------------------------------------------------------------------------
|
| The shared Webhooks/Index page links to `escalated.admin.webhooks.create`
| and `escalated.admin.webhooks.edit`, and reads the latest delivery from
| `webhook.deliveries[0]`. Neither route existed here, so the page threw on
| `route()` and there was no way to add or edit a webhook from the UI.
|
| The props and redirects follow escalated-laravel's Admin\WebhookController.
|
*/

const PREFIX = '/support/admin/webhooks'

test.group('Webhook admin pages', (group) => {
  let running: TestApp
  let client: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_webhook_deliveries').delete()
    await running.db.from('escalated_webhooks').delete()
    ;(globalThis as any).__escalated_config.webhooks = { allowPrivateUrls: true }
  })

  group.each.teardown(() => {
    ;(globalThis as any).__escalated_config.webhooks = undefined
  })

  group.each.timeout(30_000)

  async function storedWebhook() {
    const { default: Webhook } = await import('../../src/models/webhook.js')
    return Webhook.create({
      url: 'http://127.0.0.1:9/hook',
      events: ['ticket.created', 'ticket.replied'],
      active: true,
      secret: 's3cret',
    })
  }

  test('create renders Webhooks/Form with the available events', async ({ assert }) => {
    const visit = await client.visit('GET', `${PREFIX}/create`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Webhooks/Form')
    assert.includeMembers(visit.body.props.availableEvents, ['ticket.created', 'reply.created'])
    assert.notExists(visit.body.props.webhook)
  })

  test('edit renders Webhooks/Form with the webhook, its secret and canonical events', async ({
    assert,
  }) => {
    const webhook = await storedWebhook()

    const visit = await client.visit('GET', `${PREFIX}/${webhook.id}/edit`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Webhooks/Form')
    const props = visit.body.props
    assert.equal(props.webhook.id, webhook.id)
    assert.equal(props.webhook.url, 'http://127.0.0.1:9/hook')
    // The form posts `secret` back; an edit that did not show it would wipe it.
    assert.equal(props.webhook.secret, 's3cret')
    assert.isTrue(props.webhook.active)
    assert.deepEqual(props.webhook.events, ['ticket.created', 'reply.created'])
    assert.isArray(props.availableEvents)
  })

  test('edit of a missing webhook is a 404', async ({ assert }) => {
    const visit = await client.visit('GET', `${PREFIX}/999999/edit`)
    assert.equal(visit.status, 404)
  })

  test('store from the form redirects to the index', async ({ assert }) => {
    const visit = await client.visit('POST', PREFIX, {
      data: { url: 'http://127.0.0.1:9/new', events: ['ticket.created'], secret: '', active: true },
      referer: `${PREFIX}/create`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)
    const rows = await running.db.from('escalated_webhooks')
    assert.lengthOf(rows, 1)
  })

  test('update from the form redirects to the index and keeps the secret', async ({ assert }) => {
    const webhook = await storedWebhook()

    const visit = await client.visit('PUT', `${PREFIX}/${webhook.id}`, {
      data: {
        url: 'http://127.0.0.1:9/changed',
        events: ['ticket.closed'],
        secret: 's3cret',
        active: false,
      },
      referer: `${PREFIX}/${webhook.id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, PREFIX)
    const row = await running.db.from('escalated_webhooks').where('id', webhook.id).first()
    assert.equal(row.url, 'http://127.0.0.1:9/changed')
    assert.equal(row.secret, 's3cret')
  })

  test('an invalid form goes back to the form with the error', async ({ assert }) => {
    const visit = await client.visit('POST', PREFIX, {
      data: { url: 'not a url', events: [] },
      referer: `${PREFIX}/create`,
    })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${PREFIX}/create`)
  })

  test('index rows carry the latest delivery as deliveries[0]', async ({ assert }) => {
    const webhook = await storedWebhook()
    const { default: WebhookDelivery } = await import('../../src/models/webhook_delivery.js')
    await WebhookDelivery.create({
      webhookId: webhook.id,
      event: 'ticket.created',
      payload: {},
      responseCode: 204,
      attempts: 1,
    } as any)

    const visit = await client.visit('GET', PREFIX)

    assert.equal(visit.body.component, 'Escalated/Admin/Webhooks/Index')
    const [row] = visit.body.props.webhooks
    assert.equal(row.id, webhook.id)
    assert.equal(row.url, webhook.url)
    assert.isArray(row.events)
    assert.isTrue(row.active)
    assert.lengthOf(row.deliveries, 1)
    assert.equal(row.deliveries[0].response_code, 204)
  })
})
