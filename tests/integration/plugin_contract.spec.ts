import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { activateSdkPlugins } from './helpers/plugins.js'

/*
|--------------------------------------------------------------------------
| Plugin contract
|--------------------------------------------------------------------------
|
| escalated-developer-context domain-model/plugin-contract.md:
|
| - plugin menus, slots and widgets are shared as `escalated.plugins`
|   ({menuItems, pageComponents, dashboardWidgets}), the shape the shared
|   frontend's usePluginExtensions() reads. They were never shared at all.
| - the canonical events reach plugins' actions under their canonical names,
|   with the ticket flat and under `ticket`. The bridge got legacy names
|   (`ticket_created`) and native plugins got nothing.
| - ctx.tickets.query / ctx.replies.query filter only on the contract's keys;
|   the filter's keys were used as column names.
|
*/

test.group('Plugin contract', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  let sequence = 0

  async function openTicket(subject: string, extra: Record<string, unknown> = {}) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `PLUG-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject,
      description: 'Opened by the plugin contract tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
      ...extra,
    } as any)
  }

  async function hooks() {
    return (await running.app.container.make('escalated.hookManager')) as any
  }

  async function ui() {
    return (await running.app.container.make('escalated.pluginUIService')) as any
  }

  /** Collects what a native plugin's action callbacks receive. */
  async function listen(names: string[]) {
    const manager = await hooks()
    const seen: Array<[string, any]> = []
    const callbacks = names.map((name) => {
      const callback = (payload: any) => {
        seen.push([name, payload])
      }
      manager.addAction(name, callback)
      return [name, callback] as const
    })
    const stop = () => callbacks.forEach(([name, cb]) => manager.removeAction(name, cb))
    return { seen, stop }
  }

  async function until(check: () => boolean) {
    for (let attempt = 0; attempt < 50 && !check(); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  /** A stand-in for the in-process SDK bridge. */
  async function fakeBridge(manifests: Map<string, any> = new Map(), throws = false) {
    await activateSdkPlugins(...manifests.keys())
    const calls: Array<[string, any]> = []
    const bridge = {
      isBooted: () => true,
      getManifests: () => manifests,
      dispatchAction: async (hook: string, event: any) => {
        calls.push([hook, event])
        if (throws) throw new Error('runtime broke')
      },
    }
    const previous = (globalThis as any).__escalated_pluginBridge
    ;(globalThis as any).__escalated_pluginBridge = bridge
    return { calls, restore: () => ((globalThis as any).__escalated_pluginBridge = previous) }
  }

  // -------------------------------------------------------------------------
  // escalated.plugins
  // -------------------------------------------------------------------------

  test('shares native plugin menus, widgets and slots as escalated.plugins', async ({
    assert,
    cleanup,
  }) => {
    const service = await ui()
    cleanup(() => service.clear())
    service.addMenuItem({
      label: 'Billing',
      url: '/support/admin/billing',
      icon: 'cash',
      position: 5,
      section: 'admin',
    } as any)
    service.addMenuItem({
      label: 'Secret',
      url: '/x',
      permission: 'nobody-has-this',
      section: 'agent',
    } as any)
    service.addDashboardWidget({
      id: 'acme.stats',
      title: 'Stats',
      component: 'StatsWidget',
      plugin: 'acme',
      width: 'half',
    } as any)
    service.addPageComponent('ticket.show', 'sidebar', {
      component: 'Panel',
      plugin: 'acme',
      data: { a: 1 },
      position: 3,
    })

    const { escalatedSharedData } = await import('../../src/support/shared_data.js')
    const admin = await escalatedSharedData({ auth: { user: TEST_USERS.admin } })
    assert.deepEqual(
      admin.plugins.menuItems.map((item: any) => item.label),
      ['Billing', 'Secret']
    )
    assert.deepInclude(admin.plugins.menuItems[0], {
      route: '/support/admin/billing',
      icon: 'cash',
      position: 5,
      section: 'admin',
    })
    assert.deepInclude(admin.plugins.dashboardWidgets[0], {
      id: 'acme.stats',
      title: 'Stats',
      component: 'StatsWidget',
      plugin: 'acme',
      width: 'half',
    })
    assert.deepInclude(admin.plugins.pageComponents['ticket.show.sidebar'][0], {
      plugin: 'acme',
      component: 'Panel',
      position: 3,
    })

    // An agent sees neither the admin item nor the one it lacks the permission for.
    const agent = await escalatedSharedData({ auth: { user: TEST_USERS.agent } })
    assert.deepEqual(agent.plugins.menuItems, [])
  })

  test('sends {} with no extensions, and SDK widgets and slots keyed by slug', async ({
    assert,
    cleanup,
  }) => {
    const { escalatedSharedData } = await import('../../src/support/shared_data.js')
    const empty = await escalatedSharedData({ auth: { user: TEST_USERS.admin } })
    assert.deepEqual(empty.plugins, {})

    const bridge = await fakeBridge(
      new Map([
        [
          '@acme/plugin-crm',
          {
            name: '@acme/plugin-crm',
            widgets: [{ component: 'CrmWidget', label: 'CRM deals', order: 2, size: 'full' }],
            components: [
              {
                page: 'ticket.show',
                slot: 'sidebar',
                component: 'CrmPanel',
                props: { x: 1 },
                order: 4,
              },
            ],
            pages: [
              {
                route: 'settings',
                component: 'Settings',
                menu: { label: 'CRM', icon: 'users', position: 7 },
              },
            ],
          },
        ],
      ])
    )
    cleanup(bridge.restore)

    const shared = await escalatedSharedData({ auth: { user: TEST_USERS.admin } })
    assert.deepEqual(shared.plugins.menuItems, [
      {
        label: 'CRM',
        route: '/support/admin/plugins/acme--plugin-crm/settings',
        icon: 'users',
        position: 7,
        section: 'admin',
        plugin: 'acme--plugin-crm',
      },
    ])
    assert.deepEqual(shared.plugins.dashboardWidgets, [
      {
        id: 'acme--plugin-crm.CrmWidget',
        title: 'CRM deals',
        component: 'CrmWidget',
        plugin: 'acme--plugin-crm',
        position: 2,
        width: 'full',
      },
    ])
    assert.deepEqual(shared.plugins.pageComponents, {
      'ticket.show.sidebar': [
        { plugin: 'acme--plugin-crm', component: 'CrmPanel', data: { x: 1 }, position: 4 },
      ],
    })
  })

  // -------------------------------------------------------------------------
  // Canonical events
  // -------------------------------------------------------------------------

  test('creating a ticket over HTTP delivers ticket.created to native and SDK plugins', async ({
    assert,
    cleanup,
  }) => {
    const { seen, stop } = await listen(['ticket.created', 'ticket_created'])
    const bridge = await fakeBridge()
    cleanup(() => {
      stop()
      bridge.restore()
    })

    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.customer })
    const subject = `Plugin ticket ${Date.now()}`
    const visit = await client.visit('POST', '/support', {
      data: { subject, description: 'Body', priority: 'medium' },
    })
    assert.include([302, 303], visit.status)

    await until(() => seen.length > 0 && bridge.calls.length > 0)
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const ticket = await Ticket.query().where('subject', subject).firstOrFail()

    assert.deepEqual(
      seen.map(([name]) => name),
      ['ticket.created']
    )
    const payload = seen[0][1]
    assert.include(payload, {
      id: ticket.id,
      reference: ticket.reference,
      subject,
      title: subject,
      status: 'open',
    })
    for (const key of ['department_id', 'assigned_to', 'requester_id', 'metadata', 'created_at']) {
      assert.property(payload, key)
    }
    const { ticket: nested, ...flat } = payload
    assert.deepEqual(nested, flat)

    assert.deepEqual(
      bridge.calls.map(([hook]) => hook),
      ['ticket.created']
    )
    assert.equal(bridge.calls[0][1].id, ticket.id)
  })

  test('a reply delivers reply.created with reply and ticket, never a legacy name', async ({
    assert,
    cleanup,
  }) => {
    const { seen, stop } = await listen(['reply.created', 'ticket.replied', 'reply_created'])
    cleanup(stop)
    const ticket = await openTicket('Reply event')

    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.customer })
    const visit = await client.visit('POST', `/support/${ticket.reference}/reply`, {
      data: { body: 'Hello plugin' },
    })
    assert.include([302, 303], visit.status)

    await until(() => seen.length > 0)
    assert.deepEqual(
      seen.map(([name]) => name),
      ['reply.created']
    )
    const payload = seen[0][1]
    assert.include(payload, { ticket_id: ticket.id, body: 'Hello plugin', is_internal: false })
    assert.equal(payload.reply.id, payload.id)
    assert.equal(payload.ticket.id, ticket.id)
  })

  test('a throwing plugin does not fail the request', async ({ assert, cleanup }) => {
    const manager = await hooks()
    const failing = () => {
      throw new Error('plugin broke')
    }
    manager.addAction('ticket.created', failing)
    const bridge = await fakeBridge(new Map(), true)
    cleanup(() => {
      manager.removeAction('ticket.created', failing)
      bridge.restore()
    })

    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.customer })
    const subject = `Still created ${Date.now()}`
    const visit = await client.visit('POST', '/support', {
      data: { subject, description: 'Body', priority: 'low' },
    })

    assert.include([302, 303], visit.status)
    const { default: Ticket } = await import('../../src/models/ticket.js')
    assert.isNotNull(await Ticket.query().where('subject', subject).first())
  })

  // -------------------------------------------------------------------------
  // ctx
  // -------------------------------------------------------------------------

  async function context(pluginName = 'acme') {
    const { default: NativeContext } = await import('../../src/bridge/native_context.js')
    const emitted: Array<[string, unknown]> = []
    const dispatcher = {
      dispatchAction: async (hook: string, data: unknown) => void emitted.push([hook, data]),
    }
    return { ctx: new NativeContext(pluginName, () => dispatcher as any) as any, emitted }
  }

  test('ctx.tickets.query maps contract keys and rejects others', async ({ assert }) => {
    const mine = await openTicket('Query mine', {
      priority: 'high',
      assignedTo: TEST_USERS.agent.id,
    })
    await openTicket('Query other', { priority: 'low' })
    const { ctx } = await context()

    const rows = await ctx.tickets.query({ assigned_to: TEST_USERS.agent.id, priority: 'high' })
    assert.deepEqual(
      rows.map((row: any) => row.id),
      [mine.id]
    )
    const byRef = await ctx.tickets.query({ reference: mine.reference })
    assert.deepEqual(
      byRef.map((row: any) => row.id),
      [mine.id]
    )

    for (const key of ['guest_token', 'subject', 'requester_type', 'id) or 1=1 --']) {
      await assert.rejects(() => ctx.tickets.query({ [key]: 'x' }), /cannot filter/)
    }
    await assert.rejects(() => ctx.tickets.query({ id: [1, 2] }), /single value/)
  })

  test('ctx.replies.query maps is_internal and rejects other keys', async ({ assert }) => {
    const ticket = await openTicket('Reply query')
    const { default: Reply } = await import('../../src/models/reply.js')
    const note = await Reply.create({
      ticketId: ticket.id,
      body: 'note',
      isInternalNote: true,
      isPinned: false,
      type: 'note',
    } as any)
    await Reply.create({
      ticketId: ticket.id,
      body: 'public',
      isInternalNote: false,
      isPinned: false,
      type: 'reply',
    } as any)
    const { ctx } = await context()

    const rows = await ctx.replies.query({ ticket_id: ticket.id, is_internal: true })
    assert.deepEqual(
      rows.map((row: any) => row.id),
      [note.id]
    )
    await assert.rejects(() => ctx.replies.query({ is_internal_note: true }), /cannot filter/)
    await assert.rejects(() => ctx.replies.query({ body: 'note' }), /cannot filter/)
  })

  test('ctx.emit drops names that impersonate a canonical or lifecycle event', async ({
    assert,
  }) => {
    const { ctx, emitted } = await context()

    for (const hook of ['ticket.created', 'plugin.activated', 'ticket.replied', 'acme.synced']) {
      await ctx.emit(hook, { n: 1 })
    }

    assert.deepEqual(emitted, [['acme.synced', { n: 1 }]])
  })
})
