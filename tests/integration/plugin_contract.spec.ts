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

  // ctx writes take only the contract's fields: any other key is an error,
  // never an attribute, so a plugin cannot name an author, a requester, an
  // assignee or a reply's flags.

  test('ctx.replies.create writes as the acting user, or a note with is_internal', async ({
    assert,
  }) => {
    const ticket = await openTicket('Plugin reply')
    const { ctx } = await context()
    const { actingAs } = await import('../../src/bridge/native_context.js')
    const { default: Reply } = await import('../../src/models/reply.js')

    const reply = await actingAs(TEST_USERS.agent, () =>
      ctx.replies.create({ ticket_id: ticket.id, body: 'Synced' })
    )
    const note = await ctx.replies.create({
      ticket_id: ticket.id,
      body: 'Inner',
      is_internal: true,
    })

    const replyRow = await Reply.findOrFail(reply.id)
    const noteRow = await Reply.findOrFail(note.id)
    assert.equal(replyRow.ticketId, ticket.id)
    assert.isFalse(Boolean(replyRow.isInternalNote))
    assert.equal(replyRow.type, 'reply')
    assert.equal(Number(replyRow.authorId), TEST_USERS.agent.id)
    assert.equal(replyRow.authorType, 'User')
    assert.isTrue(Boolean(noteRow.isInternalNote))
    assert.equal(noteRow.type, 'note')
    assert.isNull(noteRow.authorId)
  })

  test('ctx.replies.create rejects fields outside the contract', async ({ assert }) => {
    const ticket = await openTicket('Plugin reply forged')
    const { ctx } = await context()
    const { default: Reply } = await import('../../src/models/reply.js')
    const forged: Record<string, unknown> = {
      author_id: 1,
      authorId: 1,
      author_type: 'User',
      authorType: 'User',
      is_internal_note: true,
      isInternalNote: true,
      type: 'system',
      is_pinned: true,
      metadata: { x: 1 },
      id: 99999,
    }

    for (const [key, value] of Object.entries(forged)) {
      await assert.rejects(
        () => ctx.replies.create({ ticket_id: ticket.id, body: 'x', [key]: value }),
        /does not accept/
      )
    }
    await assert.rejects(() => ctx.replies.create({ body: 'x' }), /ticket_id/)
    await assert.rejects(() => ctx.replies.create({ ticket_id: 99999999, body: 'x' }), /ticket_id/)
    await assert.rejects(() => ctx.replies.create({ ticket_id: ticket.id, body: ' ' }), /body/)
    const rows = await Reply.query().where('ticket_id', ticket.id)
    assert.lengthOf(rows, 0)
  })

  test('ctx.tickets.create takes the contract fields and aliases only', async ({ assert }) => {
    const { ctx } = await context()
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const { default: Contact } = await import('../../src/models/contact.js')

    const created = await ctx.tickets.create({
      title: `From Slack ${Date.now()}`,
      description: 'Help',
      priority: 'high',
      metadata: { slack_ts: '1.2' },
      requester_email: 'Pat@Example.com',
      requester_name: 'Pat',
    })

    const row = await Ticket.findOrFail(created.id)
    assert.match(row.subject, /^From Slack/)
    assert.equal(row.description, 'Help')
    assert.equal(row.priority, 'high')
    assert.equal(row.channel, 'api')
    assert.deepEqual(row.metadata, { slack_ts: '1.2' })
    assert.isNull(row.requesterId)
    assert.isNull(row.assignedTo)
    const contact = await Contact.findOrFail(row.contactId!)
    assert.equal(contact.email, 'pat@example.com')

    const total = async () => {
      const [counted] = await Ticket.query().count('* as total')
      return counted.$extras.total
    }
    const before = await total()
    for (const [key, value] of Object.entries({
      requester_id: 1,
      requesterId: 1,
      requester_type: 'User',
      assigned_to: 2,
      assignedTo: 2,
      reference: 'ESC-1',
      guest_token: 'x',
      sla_first_response_breached: true,
    })) {
      await assert.rejects(
        () => ctx.tickets.create({ subject: 'S', [key]: value }),
        /does not accept/
      )
    }
    assert.equal(await total(), before)
  })

  test('ctx.tickets.update takes the contract fields only', async ({ assert }) => {
    const ticket = await openTicket('Original', { priority: 'low' })
    const { ctx } = await context()
    const { default: Ticket } = await import('../../src/models/ticket.js')

    for (const [key, value] of Object.entries({
      assigned_to: TEST_USERS.agent.id,
      assignedTo: TEST_USERS.agent.id,
      requester_id: 1,
      channel: 'email',
      requester_email: 'a@b.c',
      resolved_at: '2026-01-01',
    })) {
      await assert.rejects(
        () => ctx.tickets.update(ticket.id, { subject: 'Changed', [key]: value }),
        /does not accept/
      )
    }
    const unchanged = await Ticket.findOrFail(ticket.id)
    assert.equal(unchanged.subject, 'Original')

    await ctx.tickets.update(ticket.id, { title: 'Renamed', body: 'New body', priority: 'urgent' })
    const fresh = await Ticket.findOrFail(ticket.id)
    assert.equal(fresh.subject, 'Renamed')
    assert.equal(fresh.description, 'New body')
    assert.equal(fresh.priority, 'urgent')
    assert.isNull(fresh.assignedTo)
  })

  test('ctx.contacts.create takes name and email only', async ({ assert }) => {
    const { ctx } = await context()

    await assert.rejects(
      () => ctx.contacts.create({ name: 'Eve', email: 'eve@example.com', isAdmin: true }),
      /does not accept/
    )
    await assert.rejects(
      () => ctx.contacts.create({ name: 'Eve', email: 'eve@example.com', role: 'admin' }),
      /does not accept/
    )
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
