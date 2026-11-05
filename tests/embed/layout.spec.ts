import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from '../integration/helpers/app.js'
import { routeTable } from '../integration/helpers/route_table.js'
import { setAccess } from '../integration/helpers/access.js'
import { TEST_USERS, type TestUser } from '../integration/fixtures/user.js'
import { defaultRoutes, HOST_VIEWS, movesWithAdmin, routeMiddleware } from './helpers.js'

/*
|--------------------------------------------------------------------------
| Embedded admin: layout mode
|--------------------------------------------------------------------------
|
| ADR 2026-11-05-embeddable-admin, host type A (a Vue + Inertia admin): the
| admin routes move under the host's prefix (`admin/support`) and middleware
| (`hostPanel`, the fixture host's staff check), keep their names and
| handlers, and every Inertia page shares `escalated.embed` and
| `escalated.navigation`. Rendered through the real @adonisjs/inertia.
|
*/

test.group('Embedded admin (layout mode)', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp({
      escalated: {
        enableNewsletters: true,
        ui: {
          enabled: true,
          embed: {
            enabled: true,
            mode: 'layout',
            prefix: 'admin/support',
            middleware: ['hostPanel'],
            layout: 'Layouts/AdminLayout',
          },
        },
      },
      inertia: { views: HOST_VIEWS, rootView: 'host_app' },
      routes: (hostRouter) => {
        hostRouter.get('/host/dashboard', (ctx: any) => ctx.inertia.render('Host/Dashboard', {}))
      },
    })
  })

  group.each.setup(async () => {
    setAccess({})
    return () => setAccess(undefined)
  })

  group.each.timeout(60_000)

  function as(user: TestUser | null) {
    return new InertiaClient(running.baseUrl, { user })
  }

  /** `escalated.navigation` on one of the host's own pages. */
  async function hostNavigation(user: TestUser) {
    const page = await as(user).visit('GET', '/host/dashboard')
    return page.body.props.escalated.navigation
  }

  async function router() {
    return running.app.container.make('router')
  }

  // ---- Routes ----------------------------------------------------------------

  test('an admin screen answers under the host prefix, after the host middleware', async ({
    assert,
  }) => {
    const page = await as(TEST_USERS.admin).visit('GET', '/admin/support/tags')

    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.equal(page.body.component, 'Escalated/Admin/Tags/Index')
    assert.equal(page.headers.get('x-host-panel'), 'ran')
  })

  test('the host middleware decides first: nobody signed in, or a customer', async ({ assert }) => {
    // As JSON, so the shared Error page does not stand in for the host's answer.
    const json = { inertia: false, headers: { Accept: 'application/json' } }
    const nobody = await as(null).visit('GET', '/admin/support/tags', json)
    assert.equal(nobody.status, 401)
    assert.equal(nobody.body.error, 'Host panel: sign in first.')

    const customer = await as(TEST_USERS.customer).visit('GET', '/admin/support/tags', json)
    assert.equal(customer.status, 403)
    assert.equal(customer.body.error, 'Host panel: staff only.')
  })

  test("Escalated's admin gate still refuses a non-admin the host lets through", async ({
    assert,
  }) => {
    const agent = await as(TEST_USERS.agent).visit('GET', '/admin/support/tags')

    assert.equal(agent.status, 403, JSON.stringify(agent.body))
    assert.equal(agent.headers.get('x-host-panel'), 'ran')
  })

  test('the standalone admin URLs are not registered', async ({ assert }) => {
    for (const path of ['/support/admin/tags', '/support/admin/reports', '/support/admin']) {
      const page = await as(TEST_USERS.admin).visit('GET', path)
      assert.equal(page.status, 404, path)
    }
  })

  test('every moved route keeps its name, methods and handler, with the host middleware', async ({
    assert,
  }) => {
    const live = routeTable(await router())
    const byName = new Map(live.map((row) => [`${row.name}|${row.methods}`, row]))
    const moved = defaultRoutes().filter(movesWithAdmin)
    assert.isAbove(moved.length, 200)

    for (const before of moved) {
      const after = byName.get(`${before.name}|${before.methods}`)
      assert.exists(after, `${before.name} is missing`)
      assert.equal(after!.pattern, before.pattern.replace(/^\/support\/admin/, '/admin/support'))
      assert.equal(after!.handler, before.handler)
      const [standaloneAuth, ...guards] = routeMiddleware(before)
      assert.equal(standaloneAuth, 'auth')
      const embedded = routeMiddleware(after!)
      assert.deepEqual(
        embedded.filter((name) => name !== 'applyEmbedContext'),
        ['hostPanel', ...guards]
      )
      // Last of the admin group's own middleware, before any inner group's.
      assert.equal(embedded[embedded.indexOf('ticketAccess') + 1], 'applyEmbedContext')
      assert.include(guards, 'ensureIsAdmin')
    }
  })

  test('every other route is unchanged', async ({ assert }) => {
    const live = routeTable(await router())
    const key = (row: any) => `${row.name}|${row.pattern}|${row.methods}`
    const liveByKey = new Map(live.map((row) => [key(row), row]))

    for (const before of defaultRoutes().filter((row) => !movesWithAdmin(row))) {
      const after = liveByKey.get(key(before))
      assert.exists(after, `${before.name} ${before.pattern} moved`)
      assert.deepEqual(routeMiddleware(after!), routeMiddleware(before), before.pattern)
      assert.equal(after!.handler, before.handler)
    }
    // The agent panel and the two-factor enrolment keep their URLs.
    assert.isTrue(live.some((row) => row.pattern === '/support/agent/tickets'))
    assert.isTrue(live.some((row) => row.pattern === '/support/admin/settings/two-factor'))
  })

  test('the newsletter admin keeps its standalone URL and middleware', async ({ assert }) => {
    const live = routeTable(await router())
    const index = live.find((row) => row.name === 'escalated.admin.newsletters.index')

    assert.equal(index?.pattern, '/support/admin/newsletters')
    assert.deepEqual(routeMiddleware(index!), [
      'auth',
      'ensureIsAdmin',
      'requireTwoFactor',
      'enforceRoutePermissions',
      'ticketAccess',
    ])
  })

  test('route permissions still apply on the embedded routes', async ({ assert }) => {
    setAccess({ rolesPermissions: true })
    // The admin holds no role, so no permission.
    await running.db.from('escalated_role_users').where('user_id', TEST_USERS.admin.id).delete()

    const page = await as(TEST_USERS.admin).visit('GET', '/admin/support/tags')

    assert.equal(page.status, 403, JSON.stringify(page.body))
  })

  test("an SDK plugin's admin pages move with the admin", async ({ assert }) => {
    const { RouterFactory } = await import('@adonisjs/core/factories/http')
    const { default: RouteRegistrar } = await import('../../src/bridge/route_registrar.js')
    const pluginRouter = new RouterFactory().create()
    const plugin = {
      name: '@acme/escalated-plugin-crm',
      version: '1.0.0',
      config: [],
      pages: [{ route: '/settings', component: 'CrmSettings' }],
      components: [],
      widgets: [],
      actionHooks: [],
      filterHooks: [],
      endpoints: [],
      webhooks: [],
    }
    await new RouteRegistrar({ isActive: async () => true } as any, pluginRouter).registerAll(
      new Map([[plugin.name, plugin as any]])
    )
    pluginRouter.commit()

    const [page] = routeTable(pluginRouter)
    assert.equal(page.pattern, '/admin/support/plugins/acme--escalated-plugin-crm/settings')
    assert.deepEqual(routeMiddleware(page), [
      'hostPanel',
      'ensureIsAdmin',
      'requireTwoFactor',
      'applyEmbedContext',
    ])
  })

  // ---- Props -----------------------------------------------------------------

  test('an embedded page shares escalated.embed', async ({ assert }) => {
    const page = await as(TEST_USERS.admin).visit('GET', '/admin/support/tags')

    assert.deepEqual(page.body.props.escalated.embed, {
      enabled: true,
      mode: 'layout',
      layout: 'Layouts/AdminLayout',
      route: 'escalated.admin.tags.index',
      base_url: '/admin/support',
      allowed_origins: [],
    })
  })

  test('other pages share it too, not embedded', async ({ assert }) => {
    const agentPage = await as(TEST_USERS.admin).visit('GET', '/support/agent/tickets')
    assert.equal(agentPage.status, 200, JSON.stringify(agentPage.body))
    assert.deepEqual(agentPage.body.props.escalated.embed, {
      enabled: false,
      mode: 'layout',
      layout: 'Layouts/AdminLayout',
      route: null,
      base_url: '/admin/support',
      allowed_origins: [],
    })

    const hostPage = await as(TEST_USERS.admin).visit('GET', '/host/dashboard')
    assert.equal(hostPage.body.component, 'Host/Dashboard')
    assert.isFalse(hostPage.body.props.escalated.embed.enabled)
    assert.isAbove(hostPage.body.props.escalated.navigation.length, 10)
  })

  test('layout mode adds no framing headers, and the host root view stays', async ({ assert }) => {
    const page = await as(TEST_USERS.admin).visit('GET', '/admin/support/tags')
    assert.isNull(page.headers.get('content-security-policy'))
    assert.isNull(page.headers.get('x-frame-options'))

    const full = await as(TEST_USERS.admin).visit('GET', '/admin/support/tags', {
      inertia: false,
    })
    assert.equal(full.status, 200, JSON.stringify(full.body))
    assert.include(full.body, 'data-root-view="host_app"')
  })

  // ---- Navigation ------------------------------------------------------------

  test('navigation: shape, order, URLs under the host prefix and the active item', async ({
    assert,
  }) => {
    const page = await as(TEST_USERS.admin).visit('GET', '/admin/support/tags/')
    const navigation = page.body.props.escalated.navigation

    const tags = navigation.find((item: any) => item.key === 'tags')
    assert.deepEqual(tags, {
      key: 'tags',
      label: 'Tags',
      route: 'escalated.admin.tags.index',
      url: '/admin/support/tags',
      icon: 'tags',
      position: 60,
      active: true,
      badge: null,
      plugin: null,
      children: [],
    })
    assert.deepEqual(
      navigation.filter((item: any) => item.active).map((item: any) => item.key),
      ['tags']
    )

    const positions = navigation.map((item: any) => item.position)
    assert.deepEqual(
      positions,
      [...positions].sort((a: number, b: number) => a - b)
    )
    assert.deepEqual(
      navigation.slice(0, 3).map((item: any) => item.key),
      ['reports', 'tickets', 'departments']
    )
    assert.equal(navigation.at(-1).key, 'settings')

    // The newsletter admin did not move, so its item links to its own URL.
    const newsletters = navigation.find((item: any) => item.key === 'newsletters')
    assert.equal(newsletters.url, '/support/admin/newsletters')
  })

  test('navigation is empty for anyone who fails the admin gate', async ({ assert }) => {
    const page = await as(TEST_USERS.agent).visit('GET', '/support/agent/tickets')

    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.deepEqual(page.body.props.escalated.navigation, [])
  })

  test('navigation: feature switches (roles only while roles & permissions is on, plugins)', async ({
    assert,
  }) => {
    const keys = async () => {
      const navigation = await hostNavigation(TEST_USERS.admin)
      return navigation.map((item: any) => item.key)
    }

    assert.notInclude(await keys(), 'roles')
    // Plugins are off in this application's config.
    assert.notInclude(await keys(), 'plugins')

    setAccess({ rolesPermissions: true })
    await giveAdminRole()
    assert.include(await keys(), 'roles')
  })

  test('navigation: with roles & permissions on, an item needs its permission', async ({
    assert,
  }) => {
    setAccess({ rolesPermissions: true })
    await giveRoleWith(TEST_USERS.admin, ['ticket.view', 'tag.view'])

    const navigation = await hostNavigation(TEST_USERS.admin)
    const keys = navigation.map((item: any) => item.key)

    assert.include(keys, 'tickets')
    assert.include(keys, 'tags')
    // No settings.view: no Settings.
    assert.notInclude(keys, 'settings')
    assert.notInclude(keys, 'departments')
  })

  test('navigation: plugin admin menu items are merged by position', async ({ assert }) => {
    const ui = (await running.app.container.make('escalated.pluginUIService')) as any
    ui.addMenuItem({
      label: 'Billing',
      url: '/admin/support/plugins/billing/overview',
      icon: 'credit-card',
      position: 61,
      plugin: 'billing',
      badge: 3,
      submenu: [{ label: 'Invoices', url: '/admin/support/plugins/billing/invoices' }],
    })
    ui.addMenuItem({ label: 'Agent only', url: '/x', section: 'agent', position: 1 })
    const config = (globalThis as any).__escalated_config
    config.plugins = { enabled: true }

    try {
      const navigation = await hostNavigation(TEST_USERS.admin)
      const keys = navigation.map((item: any) => item.key)

      assert.deepEqual(keys.slice(keys.indexOf('tags'), keys.indexOf('tags') + 3), [
        'tags',
        'plugin:billing:0',
        'custom-fields',
      ])
      assert.deepEqual(navigation[keys.indexOf('plugin:billing:0')], {
        key: 'plugin:billing:0',
        label: 'Billing',
        route: null,
        url: '/admin/support/plugins/billing/overview',
        icon: 'credit-card',
        position: 61,
        active: false,
        badge: 3,
        plugin: 'billing',
        children: [
          { label: 'Invoices', url: '/admin/support/plugins/billing/invoices', icon: null },
        ],
      })
      assert.notInclude(
        navigation.map((item: any) => item.label),
        'Agent only'
      )
      assert.include(keys, 'plugins')
    } finally {
      config.plugins = { enabled: false }
      ui.clear?.()
    }
  })

  test('adminNavigation() gives the same list to server-rendered layouts', async ({ assert }) => {
    const { adminNavigation } = await import('../../index.js')
    const page = await as(TEST_USERS.admin).visit('GET', '/host/dashboard')

    const items = await adminNavigation(TEST_USERS.admin)
    assert.deepEqual(items, page.body.props.escalated.navigation)
    assert.deepEqual(await adminNavigation(TEST_USERS.agent), [])
    assert.deepEqual(await adminNavigation(null), [])
  })

  // ---- Roles -------------------------------------------------------------------

  async function giveAdminRole() {
    const { seedPermissionsAndRoles } = await import('../../src/support/permission_catalog.js')
    await seedPermissionsAndRoles()
    const role = await running.db.from('escalated_roles').where('slug', 'admin').first()
    await running.db.from('escalated_role_users').where('user_id', TEST_USERS.admin.id).delete()
    await running.db.table('escalated_role_users').insert({
      role_id: Number(role.id),
      user_id: TEST_USERS.admin.id,
    })
  }

  let roleSequence = 0

  async function giveRoleWith(user: TestUser, slugs: string[]) {
    const { seedPermissionsAndRoles } = await import('../../src/support/permission_catalog.js')
    await seedPermissionsAndRoles()
    await running.db.from('escalated_role_users').where('user_id', user.id).delete()
    const slug = `embed_${++roleSequence}_${Date.now()}`
    const [id] = await running.db.table('escalated_roles').insert({
      name: slug,
      slug,
      is_system: false,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    const permissions = await running.db.from('escalated_permissions').whereIn('slug', slugs)
    await running.db
      .table('escalated_role_permissions')
      .insert(permissions.map((p: any) => ({ role_id: Number(id), permission_id: p.id })))
    await running.db.table('escalated_role_users').insert({ role_id: Number(id), user_id: user.id })
  }
})
