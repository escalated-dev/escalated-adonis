import { test } from '@japa/runner'
import { definePlugin } from '@escalated-dev/plugin-sdk'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| SDK plugin activation
|--------------------------------------------------------------------------
|
| domain-model/plugin-contract.md: SDK plugins are listed on Admin > Plugins,
| activated and deactivated there like native ones, and only active SDK
| plugins get hooks, routes, cron, badges and UI extensions. Before, every
| loaded SDK plugin got everything, and its onActivate ran on every boot.
|
*/

const PREFIX = '/support/admin/plugins'

test.group('SDK plugin activation', (group) => {
  let running: TestApp
  let client: InertiaClient
  let restore: () => void
  let bridge: any
  let log: Array<[string, string, unknown]>

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  function plugin(name: string) {
    return definePlugin({
      name,
      version: '1.2.3',
      description: `${name} plugin`,
      pages: [{ route: 'settings', component: 'Settings', menu: { label: name } } as any],
      widgets: [{ component: 'Inbox', label: 'Inbox', badge: async () => 5 } as any],
      components: [{ page: 'ticket.show', slot: 'sidebar', component: 'Panel' } as any],
      actions: {
        'ticket.created': async (event: any) => void log.push([name, 'ticket.created', event]),
        'plugin.activated': async (event: any) => void log.push([name, 'plugin.activated', event]),
        'plugin.deactivated': async (event: any) =>
          void log.push([name, 'plugin.deactivated', event]),
      },
      filters: {
        'import.adapters': async (value: any) => [...value, name],
      },
      cron: { '* * * * *': async () => void log.push([name, 'cron', null]) },
      onActivate: async () => void log.push([name, 'onActivate', null]),
      onDeactivate: async () => void log.push([name, 'onDeactivate', null]),
    } as any)
  }

  group.each.setup(async () => {
    log = []
    await running.db.from('escalated_plugins').delete()
    await running.db
      .from('escalated_settings')
      .where('key', 'plugins_sdk_activation_recorded')
      .delete()
    const { default: PluginBridge } = await import('../../src/bridge/plugin_bridge.js')
    bridge = new PluginBridge()
    await bridge.register(plugin('@acme/plugin-crm'))
    await bridge.register(plugin('@acme/plugin-quiet'))
    bridge.booted = true
    const previous = (globalThis as any).__escalated_pluginBridge
    ;(globalThis as any).__escalated_pluginBridge = bridge
    restore = () => ((globalThis as any).__escalated_pluginBridge = previous)
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    return () => restore()
  })

  async function activate(...slugs: string[]) {
    const { DateTime } = await import('luxon')
    const { default: Plugin } = await import('../../src/models/plugin.js')
    for (const slug of slugs) {
      await Plugin.updateOrCreate({ slug }, { isActive: true, activatedAt: DateTime.now() })
    }
  }

  async function row(slug: string) {
    return running.db.from('escalated_plugins').where('slug', slug).first()
  }

  test('Admin > Plugins lists SDK plugins by slug, inactive until activated', async ({
    assert,
  }) => {
    const visit = await client.visit('GET', PREFIX)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Plugins/Index')
    assert.isTrue(visit.body.props.can_upload)
    const crm = visit.body.props.plugins.find((p: any) => p.slug === 'acme--plugin-crm')
    assert.deepInclude(crm, {
      name: '@acme/plugin-crm',
      version: '1.2.3',
      is_active: false,
      activated_at: null,
      source: 'composer',
      provides: { menu_items: 1, widgets: 1, page_components: 1 },
    })
    assert.exists(visit.body.props.plugins.find((p: any) => p.slug === 'acme--plugin-quiet'))
    assert.deepEqual(log, [])
  })

  test('activating runs onActivate, then plugin.activated; again does nothing', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', `${PREFIX}/acme--plugin-crm/activate`)

    assert.equal(visit.status, 303)
    assert.equal(visit.location, PREFIX)
    const saved = await row('acme--plugin-crm')
    assert.isTrue(Boolean(saved.is_active))
    assert.exists(saved.activated_at)
    assert.deepEqual(log, [
      ['@acme/plugin-crm', 'onActivate', null],
      [
        '@acme/plugin-crm',
        'plugin.activated',
        { plugin: '@acme/plugin-crm', slug: 'acme--plugin-crm' },
      ],
    ])

    log.length = 0
    const again = await client.visit('POST', `${PREFIX}/acme--plugin-crm/activate`)
    assert.equal(again.status, 303)
    assert.deepEqual(log, [])
  })

  test('deactivating fires plugin.deactivated and onDeactivate while active, then records it', async ({
    assert,
  }) => {
    await activate('acme--plugin-crm')

    const visit = await client.visit('POST', `${PREFIX}/acme--plugin-crm/deactivate`)

    assert.equal(visit.status, 303)
    const saved = await row('acme--plugin-crm')
    assert.isFalse(Boolean(saved.is_active))
    assert.exists(saved.deactivated_at)
    assert.deepEqual(log, [
      [
        '@acme/plugin-crm',
        'plugin.deactivated',
        { plugin: '@acme/plugin-crm', slug: 'acme--plugin-crm' },
      ],
      ['@acme/plugin-crm', 'onDeactivate', null],
    ])
  })

  test('an unknown slug is an error flash, or 404 for JSON, and creates no row', async ({
    assert,
  }) => {
    const visit = await client.visit('POST', `${PREFIX}/acme--plugin-nope/activate`)
    assert.equal(visit.status, 303)

    const json = await fetch(`${running.baseUrl}${PREFIX}/acme--plugin-nope/activate`, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'x-test-user-id': String(TEST_USERS.admin.id) },
    })
    assert.equal(json.status, 404)
    assert.notExists(await row('acme--plugin-nope'))
  })

  test('an SDK plugin cannot be uninstalled: npm manages it', async ({ assert }) => {
    await activate('acme--plugin-crm')

    await client.visit('DELETE', `${PREFIX}/acme--plugin-crm`)

    const crm = await row('acme--plugin-crm')
    assert.isTrue(Boolean(crm.is_active))
  })

  test('agents cannot activate', async ({ assert }) => {
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    const visit = await agent.visit('POST', `${PREFIX}/acme--plugin-crm/activate`)

    assert.notEqual(visit.status, 303)
    assert.notExists(await row('acme--plugin-crm'))
  })

  test('only active plugins get actions and filters', async ({ assert }) => {
    await bridge.dispatchAction('ticket.created', { id: 1 })
    assert.deepEqual(await bridge.applyFilter('import.adapters', []), [])
    assert.deepEqual(log, [])

    await activate('acme--plugin-crm')
    await bridge.dispatchAction('ticket.created', { id: 1 })

    assert.deepEqual(log, [['@acme/plugin-crm', 'ticket.created', { id: 1 }]])
    assert.deepEqual(await bridge.applyFilter('import.adapters', []), ['@acme/plugin-crm'])
  })

  test('only active plugins run cron, answer badges, endpoints and webhooks', async ({
    assert,
  }) => {
    await activate('acme--plugin-crm')

    await bridge.runDueCron(new Date('2026-10-29T09:00:00Z'))
    assert.deepEqual(log, [['@acme/plugin-crm', 'cron', null]])
    assert.equal(await bridge.widgetBadge('@acme/plugin-crm', 'Inbox', null), 5)
    assert.isNull(await bridge.widgetBadge('@acme/plugin-quiet', 'Inbox', null))
    await assert.rejects(() => bridge.callEndpoint('@acme/plugin-quiet', 'GET', '/x', {}))
    await assert.rejects(() => bridge.callWebhook('@acme/plugin-quiet', 'POST', '/x', {}))
  })

  test('escalated.plugins carries active plugins only', async ({ assert }) => {
    await activate('acme--plugin-crm')
    const { escalatedSharedData } = await import('../../src/support/shared_data.js')

    const shared = await escalatedSharedData({ auth: { user: TEST_USERS.admin } })

    assert.deepEqual(
      shared.plugins.dashboardWidgets.map((w: any) => [w.plugin, w.badge]),
      [['acme--plugin-crm', 5]]
    )
    assert.deepEqual(
      shared.plugins.menuItems.map((m: any) => m.plugin),
      ['acme--plugin-crm']
    )
    assert.deepEqual(
      shared.plugins.pageComponents['ticket.show.sidebar'].map((c: any) => c.plugin),
      ['acme--plugin-crm']
    )
  })

  test('SDK plugins installed when first seen are recorded active; later ones are not', async ({
    assert,
  }) => {
    const { recordInstalledSdkPlugins } = await import('../../src/bridge/sdk_plugin_activation.js')

    await recordInstalledSdkPlugins(['@acme/plugin-crm'])
    await recordInstalledSdkPlugins(['@acme/plugin-crm', '@acme/plugin-quiet'])

    const crm = await row('acme--plugin-crm')
    assert.isTrue(Boolean(crm.is_active))
    assert.notExists(await row('acme--plugin-quiet'))
  })
})
