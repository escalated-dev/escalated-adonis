import { test } from '@japa/runner'
import { RouterFactory } from '@adonisjs/core/factories/http'
import type { PluginManifest } from '@escalated-dev/plugin-sdk'
import { testApp } from './helpers/app.js'

/*
|--------------------------------------------------------------------------
| SDK plugin endpoints and webhooks
|--------------------------------------------------------------------------
|
| domain-model/plugin-contract.md: an SDK plugin's endpoints answer at
| {METHOD} {prefix}/api/plugins/{slug}{path} behind the admin guard, and its
| webhooks at {METHOD} {prefix}/webhooks/plugins/{slug}{path} with no guard,
| as escalated-laravel and escalated-rails mount them. Only active plugins
| answer; anything else is a 404. Credentials never reach a plugin, and a
| handler that throws is a 500 without its message.
|
| Before, this package mounted them at {prefix}/plugins/{slug}/api/... and
| {prefix}/plugins/{slug}/webhooks/....
|
*/

const SLUG = 'acme--escalated-plugin-crm'

function manifest(): PluginManifest {
  return {
    name: '@acme/escalated-plugin-crm',
    version: '1.0.0',
    config: [],
    pages: [],
    components: [],
    widgets: [],
    actionHooks: [],
    filterHooks: [],
    endpoints: [
      { method: 'GET', path: '/contacts/:id' },
      { method: 'POST', path: '/boom' },
    ],
    webhooks: [{ method: 'POST', path: '/inbound' }],
  } as PluginManifest
}

class BridgeStandIn {
  calls: Array<{ kind: string; plugin: string; method: string; path: string; request: any }> = []
  actingUsers: unknown[] = []
  active = true

  /** Who ctx.currentUser() answers with while the plugin is called. */
  private async recordActingUser() {
    const { default: NativeContext } = await import('../../src/bridge/native_context.js')
    const ctx = new NativeContext('@acme/escalated-plugin-crm', () => ({}) as any)
    this.actingUsers.push(await ctx.currentUser())
  }

  async isActive() {
    return this.active
  }

  async callEndpoint(plugin: string, method: string, path: string, request: any) {
    this.calls.push({ kind: 'endpoint', plugin, method, path, request })
    await this.recordActingUser()
    if (path === '/boom') throw new Error('secret database detail')
    return { ok: true }
  }

  async callWebhook(plugin: string, method: string, path: string, request: any) {
    this.calls.push({ kind: 'webhook', plugin, method, path, request })
    await this.recordActingUser()
    return { received: true }
  }
}

async function registered(bridge: BridgeStandIn) {
  const { default: RouteRegistrar } = await import('../../src/bridge/route_registrar.js')
  const router = new RouterFactory().create()
  const plugin = manifest()
  await new RouteRegistrar(bridge as any, router).registerAll(new Map([[plugin.name, plugin]]))
  router.commit()
  return router
}

async function run(match: any, headers: Record<string, string> = {}, user: any = null) {
  const answer: { status?: number; body?: any } = {}
  const ctx: any = {
    auth: { user },
    params: match.params,
    request: { qs: () => ({ page: '2' }), headers: () => headers, body: () => ({ a: 1 }) },
    response: {
      json: (body: any) => Object.assign(answer, { status: answer.status ?? 200, body }),
      notFound: (body: any) => Object.assign(answer, { status: 404, body }),
      status: (status: number) => {
        answer.status = status
        return ctx.response
      },
    },
  }
  await match.route.handler(ctx)
  return answer
}

test.group('SDK plugin endpoints and webhooks', (group) => {
  group.setup(async () => {
    await testApp()
  })

  group.each.timeout(30_000)

  test('endpoints answer at {prefix}/api/plugins/{slug}{path}', async ({ assert }) => {
    const bridge = new BridgeStandIn()
    const router = await registered(bridge)

    const match = router.match(`/support/api/plugins/${SLUG}/contacts/42`, 'GET', true)
    assert.isNotNull(match)
    const answer = await run(match, {
      'cookie': 'session=1',
      'authorization': 'Bearer x',
      'x-xsrf-token': 't',
      'x-csrf-token': 't',
      'proxy-authorization': 'p',
      'x-request-id': 'r1',
    })

    assert.deepEqual(answer, { status: 200, body: { ok: true } })
    assert.lengthOf(bridge.calls, 1)
    const call = bridge.calls[0]
    assert.equal(call.plugin, '@acme/escalated-plugin-crm')
    assert.equal(call.path, '/contacts/:id')
    assert.deepEqual(call.request.params, { id: '42' })
    assert.deepEqual(call.request.query, { page: '2' })
    assert.deepEqual(call.request.headers, { 'x-request-id': 'r1' })
  })

  test('webhooks answer at {prefix}/webhooks/plugins/{slug}{path}', async ({ assert }) => {
    const bridge = new BridgeStandIn()
    const router = await registered(bridge)

    const match = router.match(`/support/webhooks/plugins/${SLUG}/inbound`, 'POST', true)
    assert.isNotNull(match)
    const answer = await run(match, { 'cookie': 'session=1', 'x-signature': 's' })

    assert.deepEqual(answer, { status: 200, body: { received: true } })
    assert.equal(bridge.calls[0].kind, 'webhook')
    assert.equal(bridge.calls[0].path, '/inbound')
    assert.deepEqual(bridge.calls[0].request.headers, { 'x-signature': 's' })
  })

  test('the old /plugins/{slug}/api and /plugins/{slug}/webhooks paths are gone', async ({
    assert,
  }) => {
    const router = await registered(new BridgeStandIn())

    assert.isNull(router.match(`/support/plugins/${SLUG}/api/contacts/42`, 'GET', true))
    assert.isNull(router.match(`/support/plugins/${SLUG}/webhooks/inbound`, 'POST', true))
  })

  test('an inactive plugin answers 404 and is asked nothing', async ({ assert }) => {
    const bridge = new BridgeStandIn()
    bridge.active = false
    const router = await registered(bridge)

    const endpoint = await run(router.match(`/support/api/plugins/${SLUG}/contacts/1`, 'GET', true))
    const webhook = await run(
      router.match(`/support/webhooks/plugins/${SLUG}/inbound`, 'POST', true)
    )

    assert.equal(endpoint.status, 404)
    assert.equal(webhook.status, 404)
    assert.deepEqual(bridge.calls, [])
  })

  test('a throwing endpoint is a 500 without the error message', async ({ assert }) => {
    const router = await registered(new BridgeStandIn())

    const answer = await run(router.match(`/support/api/plugins/${SLUG}/boom`, 'POST', true))

    assert.equal(answer.status, 500)
    assert.notInclude(JSON.stringify(answer.body), 'secret database detail')
  })

  test('an endpoint acts as the signed-in user; a webhook as nobody', async ({ assert }) => {
    const bridge = new BridgeStandIn()
    const router = await registered(bridge)
    const admin = { id: 7, name: 'Ada', email: 'ada@example.com' }

    await run(router.match(`/support/api/plugins/${SLUG}/contacts/1`, 'GET', true), {}, admin)
    await run(router.match(`/support/webhooks/plugins/${SLUG}/inbound`, 'POST', true), {}, admin)

    assert.deepEqual(bridge.actingUsers, [admin, null])
  })

  test('the endpoint group keeps the admin guard; webhooks have none', async ({ assert }) => {
    const router = await registered(new BridgeStandIn())

    const endpoint = router.match(`/support/api/plugins/${SLUG}/contacts/1`, 'GET', true)
    const webhook = router.match(`/support/webhooks/plugins/${SLUG}/inbound`, 'POST', true)

    assert.isAbove(endpoint!.route.middleware.all().size, 0)
    assert.equal(webhook!.route.middleware.all().size, 0)
  })
})
