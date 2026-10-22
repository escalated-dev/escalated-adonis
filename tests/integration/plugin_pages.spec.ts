import { test } from '@japa/runner'
import { RouterFactory } from '@adonisjs/core/factories/http'
import type { PluginManifest } from '@escalated-dev/plugin-sdk'
import { testApp } from './helpers/app.js'

/*
|--------------------------------------------------------------------------
| Plugin pages
|--------------------------------------------------------------------------
|
| An SDK plugin declares admin pages in its manifest (`pages`). In
| escalated-laravel each one becomes
| GET {prefix}/admin/plugins/{plugin}/{route}, which renders the shared
| Escalated/Plugin/Page component with the plugin, component, layout and the
| props the plugin's own `GET /{component}` endpoint returns.
|
| Here the registrar registered a plugin's endpoints and webhooks but not its
| pages, so a plugin's screens had no route. The shared test application runs
| with plugins off, so these tests hand the registrar a router of their own and
| a stand-in bridge, then look the routes up and run them.
|
*/

function manifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    name: '@acme/escalated-plugin-crm',
    version: '1.0.0',
    config: [],
    pages: [
      { route: '/settings', component: 'CrmSettings', layout: 'admin' },
      { route: 'reports/overview', component: 'CrmOverview' },
      { route: '', component: 'Broken' },
    ],
    components: [],
    widgets: [],
    actionHooks: [],
    filterHooks: [],
    endpoints: [],
    webhooks: [],
    ...overrides,
  } as PluginManifest
}

class BridgeStandIn {
  calls: Array<{ plugin: string; method: string; path: string }> = []

  async callEndpoint(plugin: string, method: string, path: string) {
    this.calls.push({ plugin, method, path })
    if (path === '/CrmSettings') return { apiKey: 'set', syncEnabled: true }
    throw new Error(`no endpoint ${method} ${path}`)
  }
}

async function registered(bridge: BridgeStandIn, plugin: PluginManifest) {
  const { default: RouteRegistrar } = await import('../../src/bridge/route_registrar.js')
  const router = new RouterFactory().create()
  await new RouteRegistrar(bridge as any, router).registerAll(new Map([[plugin.name, plugin]]))
  router.commit()
  return router
}

async function run(route: any) {
  const rendered: { component?: string; props?: any } = {}
  const ctx: any = {
    params: {},
    request: { qs: () => ({}), headers: () => ({}), body: () => ({}) },
    inertia: {
      render: (component: string, props: any) => Object.assign(rendered, { component, props }),
    },
    response: { json: (body: any) => body },
  }
  await route.handler(ctx)
  return rendered
}

test.group('Plugin pages', (group) => {
  group.setup(async () => {
    // Config and the host kernel come from the booted application.
    await testApp()
  })

  group.each.timeout(30_000)

  test('each manifest page is a named admin route', async ({ assert }) => {
    const router = await registered(new BridgeStandIn(), manifest())

    const settings = router.match(
      '/support/admin/plugins/acme--escalated-plugin-crm/settings',
      'GET',
      true
    )
    assert.exists(settings, 'the settings page has no route')
    assert.equal(settings!.route.name, 'escalated.plugin.acme--escalated-plugin-crm.page.settings')

    const nested = router.match(
      '/support/admin/plugins/acme--escalated-plugin-crm/reports/overview',
      'GET',
      true
    )
    assert.exists(nested)
    assert.equal(
      nested!.route.name,
      'escalated.plugin.acme--escalated-plugin-crm.page.reports--overview'
    )

    // Admin only: the configured admin middleware, then ensureIsAdmin.
    const middleware = settings!.route.middleware.all()
    assert.isAtLeast(middleware.size, 2)
  })

  test('a page renders Plugin/Page with the plugin, component, layout and its props', async ({
    assert,
  }) => {
    const bridge = new BridgeStandIn()
    const router = await registered(bridge, manifest())

    const settings = router.match(
      '/support/admin/plugins/acme--escalated-plugin-crm/settings',
      'GET',
      true
    )
    const rendered = await run(settings!.route)

    assert.equal(rendered.component, 'Escalated/Plugin/Page')
    assert.deepEqual(rendered.props, {
      plugin: '@acme/escalated-plugin-crm',
      component: 'CrmSettings',
      layout: 'admin',
      props: { apiKey: 'set', syncEnabled: true },
    })
    assert.deepInclude(bridge.calls, {
      plugin: '@acme/escalated-plugin-crm',
      method: 'GET',
      path: '/CrmSettings',
    })
  })

  test('a page without a props endpoint renders with empty props and the default layout', async ({
    assert,
  }) => {
    const router = await registered(new BridgeStandIn(), manifest())

    const nested = router.match(
      '/support/admin/plugins/acme--escalated-plugin-crm/reports/overview',
      'GET',
      true
    )
    const rendered = await run(nested!.route)

    assert.equal(rendered.component, 'Escalated/Plugin/Page')
    assert.deepEqual(rendered.props, {
      plugin: '@acme/escalated-plugin-crm',
      component: 'CrmOverview',
      layout: 'admin',
      props: {},
    })
  })

  test('a plugin without pages registers no page routes', async ({ assert }) => {
    const router = await registered(new BridgeStandIn(), manifest({ pages: [] }))

    assert.isNull(
      router.match('/support/admin/plugins/acme--escalated-plugin-crm/settings', 'GET', true)
    )
  })
})
