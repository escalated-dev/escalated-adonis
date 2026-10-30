import { test } from '@japa/runner'
import { definePlugin } from '@escalated-dev/plugin-sdk'
import { testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { activateSdkPlugins } from './helpers/plugins.js'

/*
|--------------------------------------------------------------------------
| Plugin cron schedules and widget badges
|--------------------------------------------------------------------------
|
| domain-model/plugin-contract.md (Cron, Badges): once a minute the host runs
| each due five-field (UTC) `cron` schedule of each active SDK plugin, as no
| user; a widget with a `badge` function carries its answer, asked as the
| viewer, in `escalated.plugins.dashboardWidgets[].badge` (`null` when it
| fails). Neither ever happened here: schedules never ran and badges were
| never asked for.
|
*/

test.group('Plugin cron and badges', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  /** A real in-process bridge with one SDK plugin registered, standing in as the host's. */
  async function withPlugin(plugin: ReturnType<typeof definePlugin>) {
    const { default: PluginBridge } = await import('../../src/bridge/plugin_bridge.js')
    const bridge = new PluginBridge()
    await bridge.register(plugin)
    ;(bridge as any).booted = true
    await activateSdkPlugins(plugin.name)
    const previous = (globalThis as any).__escalated_pluginBridge
    ;(globalThis as any).__escalated_pluginBridge = bridge
    return { bridge, restore: () => ((globalThis as any).__escalated_pluginBridge = previous) }
  }

  async function runCron(at: string) {
    const ace = await running.app.container.make('ace')
    ace.ui.switchMode('raw')
    await ace.boot()
    const command = await ace.exec('escalated:plugins:cron', ['--at', at])
    return { command, logs: ace.ui.logger.getLogs().map((log: any) => log.message as string) }
  }

  test('due schedules of an active SDK plugin run once for that minute, as no user', async ({
    assert,
    cleanup,
  }) => {
    const ran: Array<[string, unknown]> = []
    const plugin = definePlugin({
      name: '@acme/plugin-cron',
      version: '1.0.0',
      cron: {
        '* * * * *': async (ctx) => void ran.push(['* * * * *', await ctx.currentUser()]),
        '0 9 * * *': async (ctx) => void ran.push(['0 9 * * *', await ctx.currentUser()]),
        '30 9 * * *': async () => void ran.push(['30 9 * * *', null]),
        'not a schedule': async () => void ran.push(['not a schedule', null]),
      },
    })
    const { restore } = await withPlugin(plugin)
    cleanup(restore)

    const nine = await runCron('2026-10-29T09:00:20Z')
    assert.equal(nine.command.exitCode, 0, JSON.stringify(nine.logs))
    assert.sameDeepMembers(ran, [
      ['* * * * *', null],
      ['0 9 * * *', null],
    ])

    ran.length = 0
    await runCron('2026-10-29T09:01:00Z')
    assert.deepEqual(ran, [['* * * * *', null]])
  })

  test('a failing schedule is logged and never stops the others', async ({ assert, cleanup }) => {
    const ran: string[] = []
    const plugin = definePlugin({
      name: '@acme/plugin-cron-broken',
      version: '1.0.0',
      cron: {
        '0 * * * *': async () => {
          throw new Error('schedule broke')
        },
        '*/5 * * * *': async () => void ran.push('*/5 * * * *'),
      },
    })
    const { restore } = await withPlugin(plugin)
    cleanup(restore)

    const result = await runCron('2026-10-29T10:00:00Z')
    assert.equal(result.command.exitCode, 0)
    assert.deepEqual(ran, ['*/5 * * * *'])
  })

  test('nothing runs when the bridge has not booted', async ({ assert, cleanup }) => {
    const ran: string[] = []
    const { bridge, restore } = await withPlugin(
      definePlugin({
        name: '@acme/plugin-off',
        version: '1.0.0',
        cron: { '* * * * *': async () => void ran.push('ran') },
      })
    )
    ;(bridge as any).booted = false
    cleanup(restore)

    await runCron('2026-10-29T10:00:00Z')
    assert.deepEqual(ran, [])
  })

  test('widget badges are asked as the viewer; a failing one is null', async ({
    assert,
    cleanup,
  }) => {
    const plugin = definePlugin({
      name: '@acme/plugin-badges',
      version: '1.0.0',
      widgets: [
        { component: 'Plain', label: 'Plain', size: 'full' },
        {
          component: 'Inbox',
          label: 'Inbox',
          order: 2,
          badge: async (ctx) => {
            const user = await ctx.currentUser()
            return `for ${user ? user.id : 'nobody'}`
          },
        },
        { component: 'Count', label: 'Count', order: 3, badge: async () => 7 },
        {
          component: 'Broken',
          label: 'Broken',
          order: 4,
          badge: async () => {
            throw new Error('badge broke')
          },
        },
      ],
    } as any)
    const { restore } = await withPlugin(plugin)
    cleanup(restore)

    // The `escalated` shared prop for a request signed in as the admin (the
    // test application's Inertia shares no props, as in plugin_contract.spec).
    const { escalatedSharedData } = await import('../../src/support/shared_data.js')
    const shared = await escalatedSharedData({ auth: { user: TEST_USERS.admin } })

    const widgets = Object.fromEntries(
      shared.plugins.dashboardWidgets.map((w: any) => [w.component, w])
    )
    assert.equal(widgets.Inbox.badge, `for ${TEST_USERS.admin.id}`)
    assert.equal(widgets.Count.badge, 7)
    assert.property(widgets.Broken, 'badge')
    assert.isNull(widgets.Broken.badge)
    assert.notProperty(widgets.Plain, 'badge')
  })
})
