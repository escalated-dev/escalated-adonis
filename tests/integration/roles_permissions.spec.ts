import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS, type TestUser } from './fixtures/user.js'
import { setAccess } from './helpers/access.js'

/*
|--------------------------------------------------------------------------
| Roles & permissions behind an install-level switch
|--------------------------------------------------------------------------
|
| ADR 2026-10-29-configurable-access-features. Roles and permissions were
| stored and shared with the frontend, but no admin, agent or API route checked
| them, so a "Light Agent" could still assign, close and delete tickets.
|
| `access.rolesPermissions` (ESCALATED_ROLES_PERMISSIONS) now decides. Off, the
| default: the roles screens answer 404 and the host gates decide everything.
| On: every admin, agent and staff API route also needs its permission from
| the user's roles (src/support/route_permissions.ts), failing closed.
|
| The two-factor and SSO switches are left at their default here, off, so
| they are reported off and their screens 404 (two-factor on is covered by
| two_factor.spec.ts).
|
*/

const ADMIN = '/support/admin'
const AGENT = '/support/agent'
const API = '/support/api/v1'

test.group('Roles & permissions', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    setAccess({})
    await running.db.from('escalated_role_users').delete()
    await running.db.from('escalated_role_permissions').delete()
    await running.db.from('escalated_roles').delete()
    await running.db.from('escalated_permissions').delete()
    const { seedPermissionsAndRoles } = await import('../../src/support/permission_catalog.js')
    await seedPermissionsAndRoles()
    // The migration seeds settings with JS dates, which SQLite keeps as numbers
    // that the settings model cannot read back.
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
    return () => setAccess(undefined)
  })

  group.each.timeout(60_000)

  // ---- Helpers ------------------------------------------------------------------

  function as(user: TestUser) {
    return new InertiaClient(running.baseUrl, { user })
  }

  function enforce() {
    setAccess({ rolesPermissions: true })
  }

  async function roleId(slug: string): Promise<number> {
    const row = await running.db.from('escalated_roles').where('slug', slug).first()
    return Number(row.id)
  }

  async function giveRole(user: TestUser, slug: string) {
    await running.db.table('escalated_role_users').insert({
      role_id: await roleId(slug),
      user_id: user.id,
    })
  }

  let roleSequence = 0

  /** A role granting exactly these permissions, given to the user. */
  async function giveRoleWith(user: TestUser, slugs: string[]) {
    const slug = `custom_${++roleSequence}_${Date.now()}`
    const [id] = await running.db.table('escalated_roles').insert({
      name: slug,
      slug,
      is_system: false,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    const permissions = await running.db.from('escalated_permissions').whereIn('slug', slugs)
    if (permissions.length > 0) {
      await running.db
        .table('escalated_role_permissions')
        .insert(permissions.map((p: any) => ({ role_id: Number(id), permission_id: p.id })))
    }
    await running.db.table('escalated_role_users').insert({ role_id: Number(id), user_id: user.id })
  }

  let ticketSequence = 0

  async function openTicket(status = 'open') {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `RP-${Date.now()}-${++ticketSequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject: 'Roles & permissions',
      description: 'Opened by the roles & permissions tests',
      status,
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  async function tokenFor(owner: TestUser) {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(
      { id: owner.id, constructor: { name: 'User' } },
      'roles & permissions',
      ['agent', 'admin']
    )
    return plainTextToken
  }

  function api(method: string, path: string, token: string, data?: unknown) {
    return new InertiaClient(running.baseUrl).visit(method, `${API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      data,
    })
  }

  async function shared(user: TestUser) {
    const { escalatedSharedData } = await import('../../src/support/shared_data.js')
    return escalatedSharedData({ auth: { user } })
  }

  const ROLE_SCREENS: Array<[string, string, unknown?]> = [
    ['GET', `${ADMIN}/roles`],
    ['GET', `${ADMIN}/roles/create`],
    ['POST', `${ADMIN}/roles`, { name: 'Support lead', permissions: [] }],
    ['PUT', `${ADMIN}/users/${TEST_USERS.agent.id}/roles`, { role_ids: [] }],
  ]

  // ---- Switch off (the default) -------------------------------------------------

  test('is off by default, and the roles screens answer 404', async ({ assert }) => {
    const { rolesPermissionsEnabled } = await import('../../src/support/access_features.js')
    assert.isFalse(rolesPermissionsEnabled())

    await giveRole(TEST_USERS.admin, 'admin')
    for (const [method, path, data] of ROLE_SCREENS) {
      const visit = await as(TEST_USERS.admin).visit(method, path, { data })
      assert.equal(visit.status, 404, `${method} ${path}: ${JSON.stringify(visit.body)}`)
    }
  })

  test('shares the switches as false and a wildcard permission set for staff while off', async ({
    assert,
  }) => {
    for (const user of [TEST_USERS.admin, TEST_USERS.agent]) {
      const data = await shared(user)
      assert.deepEqual(data.permissions, ['*'])
      assert.isFalse(data.features.roles_permissions)
      assert.isFalse(data.features.two_factor)
      assert.isFalse(data.features.sso)
      assert.isFalse(data.two_factor_required)
    }
    const customer = await shared(TEST_USERS.customer)
    assert.deepEqual(customer.permissions, [])
  })

  test('lets the gates alone decide while off: requests refused while on succeed', async ({
    assert,
  }) => {
    // No roles at all: the admin and agent gates are the only authority.
    const ticket = await openTicket()

    const settings = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/settings`)
    assert.equal(settings.status, 200, JSON.stringify(settings.body))

    const tag = await as(TEST_USERS.admin).visit('POST', `${ADMIN}/tags`, {
      data: { name: 'Off switch' },
      referer: `${ADMIN}/tags`,
    })
    assert.notEqual(tag.status, 403, JSON.stringify(tag.body))

    for (const [path, data] of [
      [`/tickets/${ticket.reference}/assign`, { agent_id: TEST_USERS.agent.id }],
      [`/tickets/${ticket.reference}/priority`, { priority: 'high' }],
      [`/tickets/${ticket.reference}/status`, { status: 'closed' }],
    ] as const) {
      const visit = await as(TEST_USERS.agent).visit('POST', `${AGENT}${path}`, {
        data,
        referer: `${AGENT}/tickets/${ticket.reference}`,
      })
      assert.equal(visit.status, 302, `${path}: ${JSON.stringify(visit.body)}`)
    }

    const token = await tokenFor(TEST_USERS.agent)
    const list = await api('GET', '/tickets', token)
    assert.equal(list.status, 200, JSON.stringify(list.body))

    // Shared gates still apply: a customer is not let in.
    const customer = await as(TEST_USERS.customer).visit('GET', `${ADMIN}/settings`)
    assert.equal(customer.status, 403)
  })

  test('applies the newsletter permissions only while on', async ({ assert }) => {
    const { allows } = await import('../../src/support/permissions.js')
    assert.isTrue(await allows(TEST_USERS.admin.id, 'newsletters.send'))

    enforce()
    assert.isFalse(await allows(TEST_USERS.admin.id, 'newsletters.send'))
    await giveRole(TEST_USERS.admin, 'admin')
    assert.isTrue(await allows(TEST_USERS.admin.id, 'newsletters.send'))
  })

  test('the switches are config only: a stored setting with the same name changes nothing', async ({
    assert,
  }) => {
    await giveRole(TEST_USERS.admin, 'admin')
    for (const key of ['roles_permissions', 'rolesPermissions', 'two_factor', 'sso']) {
      await running.db.from('escalated_settings').where('key', key).delete()
      await running.db.table('escalated_settings').insert({
        key,
        value: 'true',
        created_at: sqlTimestamp(),
        updated_at: sqlTimestamp(),
      })
    }
    const posted = await as(TEST_USERS.admin).visit('POST', `${ADMIN}/settings`, {
      data: { roles_permissions: true, rolesPermissions: true, two_factor: true, sso: true },
      referer: `${ADMIN}/settings`,
    })
    assert.notEqual(posted.status, 500, JSON.stringify(posted.body))

    const roles = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/roles`)
    assert.equal(roles.status, 404)
    const data = await shared(TEST_USERS.admin)
    assert.isFalse(data.features.roles_permissions)
    assert.isFalse(data.features.two_factor)
    assert.isFalse(data.features.sso)
    assert.deepEqual(data.permissions, ['*'])

    await running.db
      .from('escalated_settings')
      .whereIn('key', ['roles_permissions', 'rolesPermissions', 'two_factor', 'sso'])
      .delete()
  })

  test('the two-factor screens and challenge answer 404 while two-factor is off', async ({
    assert,
  }) => {
    enforce()
    await giveRole(TEST_USERS.admin, 'admin')
    for (const [method, path] of [
      ['GET', `${ADMIN}/settings/two-factor`],
      ['POST', `${ADMIN}/settings/two-factor/setup`],
      ['POST', `${ADMIN}/settings/two-factor/confirm`],
      ['POST', `${ADMIN}/settings/two-factor/disable`],
      ['GET', '/support/two-factor/challenge'],
      ['POST', '/support/two-factor/challenge'],
    ]) {
      const visit = await as(TEST_USERS.admin).visit(method, path, {
        data: method === 'GET' ? undefined : {},
      })
      assert.equal(visit.status, 404, `${method} ${path}: ${JSON.stringify(visit.body)}`)
    }
  })

  // ---- Switch on ----------------------------------------------------------------

  test('shows the roles screens to a user with role permissions while on', async ({ assert }) => {
    enforce()
    await giveRoleWith(TEST_USERS.admin, ['role.view'])

    const index = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/roles`)
    assert.equal(index.status, 200, JSON.stringify(index.body))
    assert.equal(index.body.component, 'Escalated/Admin/Roles/Index')

    const store = await as(TEST_USERS.admin).visit('POST', `${ADMIN}/roles`, {
      data: { name: 'Support lead', permissions: [] },
    })
    assert.equal(store.status, 403, JSON.stringify(store.body))
    assert.equal(store.body.permission, 'role.manage')

    const data = await shared(TEST_USERS.admin)
    assert.isTrue(data.features.roles_permissions)
    assert.deepEqual(data.permissions, ['role.view'])
  })

  test('grants nothing to an admin without a role', async ({ assert }) => {
    enforce()
    for (const [method, path] of [
      ['GET', `${ADMIN}/settings`],
      ['GET', `${ADMIN}/tags`],
      ['GET', `${ADMIN}/tickets`],
      ['GET', `${ADMIN}/roles`],
    ]) {
      const visit = await as(TEST_USERS.admin).visit(method, path)
      assert.equal(visit.status, 403, `${method} ${path}: ${JSON.stringify(visit.body)}`)
    }
    const data = await shared(TEST_USERS.admin)
    assert.deepEqual(data.permissions, [])
  })

  test('lets an admin with the admin role through', async ({ assert }) => {
    enforce()
    await giveRole(TEST_USERS.admin, 'admin')
    for (const path of [`${ADMIN}/settings`, `${ADMIN}/tags`, `${ADMIN}/roles`]) {
      const visit = await as(TEST_USERS.admin).visit('GET', path)
      assert.equal(visit.status, 200, `${path}: ${JSON.stringify(visit.body)}`)
    }
  })

  test('checks admin reads and writes against separate permissions', async ({ assert }) => {
    enforce()
    await giveRoleWith(TEST_USERS.admin, ['tag.view', 'department.view'])

    const read = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/tags`)
    assert.equal(read.status, 200, JSON.stringify(read.body))
    const departments = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/departments`)
    assert.equal(departments.status, 200, JSON.stringify(departments.body))

    const write = await as(TEST_USERS.admin).visit('POST', `${ADMIN}/tags`, {
      data: { name: 'Needs manage' },
    })
    assert.equal(write.status, 403, JSON.stringify(write.body))
    assert.equal(write.body.permission, 'tag.manage')

    await giveRoleWith(TEST_USERS.admin, ['tag.manage'])
    const allowed = await as(TEST_USERS.admin).visit('POST', `${ADMIN}/tags`, {
      data: { name: 'Now allowed' },
      referer: `${ADMIN}/tags`,
    })
    assert.notEqual(allowed.status, 403, JSON.stringify(allowed.body))
    const row = await running.db.from('escalated_tags').where('name', 'Now allowed').first()
    assert.exists(row)
  })

  test('limits a light agent to viewing tickets and adding notes', async ({ assert }) => {
    enforce()
    await giveRole(TEST_USERS.agent, 'light_agent')
    const ticket = await openTicket()
    const agent = as(TEST_USERS.agent)
    const referer = `${AGENT}/tickets/${ticket.reference}`

    const show = await agent.visit('GET', `${AGENT}/tickets/${ticket.reference}`)
    assert.equal(show.status, 200, JSON.stringify(show.body))

    const note = await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/note`, {
      data: { body: 'Internal note from a light agent' },
      referer,
    })
    assert.equal(note.status, 302, JSON.stringify(note.body))

    for (const [path, data, permission] of [
      ['assign', { agent_id: TEST_USERS.agent.id }, 'ticket.assign'],
      ['priority', { priority: 'urgent' }, 'ticket.edit'],
      ['status', { status: 'closed' }, 'ticket.edit'],
    ] as const) {
      const visit = await agent.visit('POST', `${AGENT}/tickets/${ticket.reference}/${path}`, {
        data,
        referer,
      })
      assert.equal(visit.status, 403, `${path}: ${JSON.stringify(visit.body)}`)
      assert.equal(visit.body.permission, permission)
    }

    const bulkDelete = await agent.visit('POST', `${AGENT}/tickets/bulk`, {
      data: { ticket_ids: [ticket.id], action: 'delete' },
      referer: `${AGENT}/tickets`,
    })
    assert.equal(bulkDelete.status, 403, JSON.stringify(bulkDelete.body))

    const after = await running.db.from('escalated_tickets').where('id', ticket.id).first()
    assert.equal(after.status, 'open')
    assert.equal(after.priority, 'low')
    assert.isNull(after.assigned_to ?? null)
    assert.isNull(after.deleted_at ?? null)
  })

  test('lets a full agent assign, change priority and close', async ({ assert }) => {
    enforce()
    await giveRole(TEST_USERS.agent, 'agent')
    const ticket = await openTicket()
    const referer = `${AGENT}/tickets/${ticket.reference}`

    for (const [path, data] of [
      ['assign', { agent_id: TEST_USERS.agent.id }],
      ['priority', { priority: 'high' }],
      ['status', { status: 'closed' }],
    ] as const) {
      const visit = await as(TEST_USERS.agent).visit(
        'POST',
        `${AGENT}/tickets/${ticket.reference}/${path}`,
        { data, referer }
      )
      assert.equal(visit.status, 302, `${path}: ${JSON.stringify(visit.body)}`)
    }
  })

  test('needs ticket.close only to close, resolve or reopen', async ({ assert }) => {
    enforce()
    await giveRoleWith(TEST_USERS.agent, ['ticket.view', 'ticket.edit'])
    const referer = `${AGENT}/tickets`

    const ticket = await openTicket()
    const progress = await as(TEST_USERS.agent).visit(
      'POST',
      `${AGENT}/tickets/${ticket.reference}/status`,
      { data: { status: 'in_progress' }, referer }
    )
    assert.equal(progress.status, 302, JSON.stringify(progress.body))

    for (const status of ['closed', 'resolved', 'reopened']) {
      const visit = await as(TEST_USERS.agent).visit(
        'POST',
        `${AGENT}/tickets/${ticket.reference}/status`,
        { data: { status }, referer }
      )
      assert.equal(visit.status, 403, `${status}: ${JSON.stringify(visit.body)}`)
      assert.equal(visit.body.permission, 'ticket.close')
    }

    await giveRoleWith(TEST_USERS.agent, ['ticket.close'])
    const closed = await as(TEST_USERS.agent).visit(
      'POST',
      `${AGENT}/tickets/${ticket.reference}/status`,
      { data: { status: 'closed' }, referer }
    )
    assert.equal(closed.status, 302, JSON.stringify(closed.body))
  })

  test('checks each bulk action against its own permission', async ({ assert }) => {
    enforce()
    await giveRoleWith(TEST_USERS.agent, ['ticket.view', 'ticket.edit'])
    const ticket = await openTicket()
    const bulk = (data: Record<string, unknown>) =>
      as(TEST_USERS.agent).visit('POST', `${AGENT}/tickets/bulk`, {
        data: { ticket_ids: [ticket.id], ...data },
        referer: `${AGENT}/tickets`,
      })

    const priority = await bulk({ action: 'priority', value: 'high' })
    assert.equal(priority.status, 302, JSON.stringify(priority.body))
    const progress = await bulk({ action: 'status', value: 'in_progress' })
    assert.equal(progress.status, 302, JSON.stringify(progress.body))

    for (const [data, permission] of [
      [{ action: 'assign', value: TEST_USERS.agent.id }, 'ticket.assign'],
      [{ action: 'delete' }, 'ticket.delete'],
      [{ action: 'status', value: 'closed' }, 'ticket.close'],
    ] as const) {
      const visit = await bulk(data)
      assert.equal(visit.status, 403, `${JSON.stringify(data)}: ${JSON.stringify(visit.body)}`)
      assert.equal(visit.body.permission, permission)
    }

    const after = await running.db.from('escalated_tickets').where('id', ticket.id).first()
    assert.isNull(after.deleted_at ?? null)
    assert.notEqual(after.status, 'closed')
  })

  test("checks the API token owner's permissions", async ({ assert }) => {
    enforce()
    const token = await tokenFor(TEST_USERS.agent)
    const ticket = await openTicket()

    const noRole = await api('GET', '/tickets', token)
    assert.equal(noRole.status, 403, JSON.stringify(noRole.body))

    await giveRole(TEST_USERS.agent, 'light_agent')
    const list = await api('GET', '/tickets', token)
    assert.equal(list.status, 200, JSON.stringify(list.body))

    const assign = await api('POST', `/tickets/${ticket.reference}/assign`, token, {
      agent_id: TEST_USERS.agent.id,
    })
    assert.equal(assign.status, 403, JSON.stringify(assign.body))
    assert.equal(assign.body.permission, 'ticket.assign')

    const close = await api('PATCH', `/tickets/${ticket.reference}/status`, token, {
      status: 'closed',
    })
    assert.equal(close.status, 403, JSON.stringify(close.body))

    // An admin's token: the admin gate and the token's admin ability are not
    // enough to delete without ticket.delete.
    const adminToken = await tokenFor(TEST_USERS.admin)
    await giveRole(TEST_USERS.admin, 'light_agent')
    const destroy = await api('DELETE', `/tickets/${ticket.reference}`, adminToken)
    assert.equal(destroy.status, 403, JSON.stringify(destroy.body))
    assert.equal(destroy.body.permission, 'ticket.delete')
  })

  // ---- The route map ------------------------------------------------------------

  /** Mobile guest routes serve customers, and the public auth routes take no token. */
  function isStaffRoute(name: string) {
    if (!/^escalated\.(admin|agent|api)\./.test(name)) return false
    if (name.startsWith('escalated.api.mobile.')) return false
    return !/^escalated\.api\.auth\.(login|register|logout|refresh|me|profile)$/.test(name)
  }

  async function staffRoutes() {
    const router = await running.app.container.make('router')
    const routes = Object.values(router.toJSON()).flat() as any[]
    return routes.filter((route) => typeof route.name === 'string' && isStaffRoute(route.name))
  }

  test('maps every admin, agent and staff API route to a permission', async ({ assert }) => {
    const { isMapped } = await import('../../src/support/route_permissions.js')
    const routes = await staffRoutes()
    assert.isAbove(routes.length, 150)

    const unmapped = routes.map((route) => route.name).filter((name) => !isMapped(name))
    assert.deepEqual(unmapped, [], 'routes missing from src/support/route_permissions.ts')
  })

  test('refuses every mapped staff route to a staff user without a role', async ({ assert }) => {
    enforce()
    const { mappedPermissions } = await import('../../src/support/route_permissions.js')
    const adminToken = await tokenFor(TEST_USERS.admin)
    const failures: string[] = []

    for (const route of await staffRoutes()) {
      if ((mappedPermissions(route.name) ?? []).length === 0) continue
      // GET /support/agent is answered by the customer route /support/:ticket,
      // registered first, so this request never reaches the agent dashboard.
      if (route.name === 'escalated.agent.dashboard') continue
      const path = String(route.pattern)
        .replace(/:(\w+)/g, (_: string, param: string) =>
          /^(id|jobId)$/.test(param) && /import/.test(route.pattern)
            ? '00000000-0000-4000-8000-000000000000'
            : '1'
        )
        .replace(/(.)\/$/, '$1')
      for (const method of (route.methods as string[]).filter((m) => m !== 'HEAD')) {
        const body = method === 'GET' ? undefined : {}
        const visit = route.name.startsWith('escalated.api.')
          ? await api(method, path.replace(/^\/?support\/api\/v1/, ''), adminToken, body)
          : await as(TEST_USERS.admin).visit(method, `/${path.replace(/^\//, '')}`, {
              data: body,
            })
        if (visit.status !== 403) failures.push(`${method} ${route.name} -> ${visit.status}`)
      }
    }

    assert.deepEqual(failures, [])
  })

  test('refuses a staff route that has no permission mapping', async ({ assert }) => {
    enforce()
    await giveRole(TEST_USERS.admin, 'admin')
    const { requiredPermissions } = await import('../../src/support/route_permissions.js')
    assert.isNull(requiredPermissions('escalated.admin.brand-new-screen', () => undefined))

    const { default: EnforceRoutePermissions } =
      await import('../../src/middleware/enforce_route_permissions.js')
    let status = 0
    let reachedNext = false
    await new EnforceRoutePermissions().handle(
      {
        auth: { user: TEST_USERS.admin },
        route: { name: 'escalated.admin.brand-new-screen' },
        request: { input: () => undefined },
        response: {
          forbidden: () => {
            status = 403
          },
        },
      } as any,
      async () => {
        reachedNext = true
      }
    )
    assert.equal(status, 403)
    assert.isFalse(reachedNext)
  })

  // ---- Giving users roles ---------------------------------------------------------

  test('assigns a role from the command line', async ({ assert }) => {
    const ace = await running.app.container.make('ace')
    ace.ui.switchMode('raw')
    await ace.boot()

    const command = await ace.exec('escalated:roles:assign', [
      String(TEST_USERS.agent.id),
      'light_agent',
    ])
    assert.equal(command.exitCode, 0)
    const rows = await running.db
      .from('escalated_role_users')
      .where('user_id', TEST_USERS.agent.id)
      .where('role_id', await roleId('light_agent'))
    assert.lengthOf(rows, 1)

    // Idempotent, and an unknown role fails.
    const again = await ace.exec('escalated:roles:assign', [
      String(TEST_USERS.agent.id),
      'light_agent',
    ])
    assert.equal(again.exitCode, 0)
    const unknown = await ace.exec('escalated:roles:assign', [
      String(TEST_USERS.agent.id),
      'no_such_role',
    ])
    assert.equal(unknown.exitCode, 1)
    const nobody = await ace.exec('escalated:roles:assign', ['999999', 'admin'])
    assert.equal(nobody.exitCode, 1)
  })

  test("lets a role manager set a user's roles while on", async ({ assert }) => {
    enforce()
    await giveRole(TEST_USERS.admin, 'admin')
    await giveRole(TEST_USERS.agent, 'light_agent')

    const visit = await as(TEST_USERS.admin).visit(
      'PUT',
      `${ADMIN}/users/${TEST_USERS.agent.id}/roles`,
      { data: { role_ids: [await roleId('agent')] }, referer: `${ADMIN}/users` }
    )
    assert.equal(visit.status, 302, JSON.stringify(visit.body))

    const rows = await running.db.from('escalated_role_users').where('user_id', TEST_USERS.agent.id)
    assert.deepEqual(
      rows.map((row: any) => Number(row.role_id)),
      [await roleId('agent')]
    )
  })

  test('refuses role changes without role.manage', async ({ assert }) => {
    enforce()
    await giveRoleWith(TEST_USERS.admin, ['user.view', 'user.manage', 'role.view'])

    const visit = await as(TEST_USERS.admin).visit(
      'PUT',
      `${ADMIN}/users/${TEST_USERS.agent.id}/roles`,
      { data: { role_ids: [await roleId('admin')] } }
    )
    assert.equal(visit.status, 403, JSON.stringify(visit.body))
    assert.equal(visit.body.permission, 'role.manage')
  })

  test('does not let a role manager remove their own role management', async ({ assert }) => {
    enforce()
    await giveRole(TEST_USERS.admin, 'admin')

    const visit = await as(TEST_USERS.admin).visit(
      'PUT',
      `${ADMIN}/users/${TEST_USERS.admin.id}/roles`,
      { data: { role_ids: [await roleId('agent')] }, referer: `${ADMIN}/users` }
    )
    assert.equal(visit.status, 302, JSON.stringify(visit.body))

    const rows = await running.db.from('escalated_role_users').where('user_id', TEST_USERS.admin.id)
    assert.deepEqual(
      rows.map((row: any) => Number(row.role_id)),
      [await roleId('admin')]
    )
  })

  test("sends the roles and each user's role slugs on Admin > Users while on", async ({
    assert,
  }) => {
    const off = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/users`)
    assert.equal(off.status, 200, JSON.stringify(off.body).slice(0, 600))
    assert.notProperty(off.body.props, 'roles')

    enforce()
    await giveRole(TEST_USERS.admin, 'admin')
    await giveRole(TEST_USERS.agent, 'light_agent')

    const page = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/users`)
    assert.equal(page.status, 200)
    const names = page.body.props.roles.map((role: any) => role.name)
    assert.deepEqual(names, [...names].sort())
    assert.sameMembers(Object.keys(page.body.props.roles[0]), ['id', 'name', 'slug'])
    const rows = Object.fromEntries(
      page.body.props.users.data.map((user: any) => [String(user.id), user.roles])
    )
    assert.deepEqual(rows[String(TEST_USERS.admin.id)], ['admin'])
    assert.deepEqual(rows[String(TEST_USERS.agent.id)], ['light_agent'])
  })

  test("validates role_ids as Laravel's rules do, back to the screen with the errors", async ({
    assert,
  }) => {
    enforce()
    await giveRole(TEST_USERS.admin, 'admin')
    await giveRole(TEST_USERS.agent, 'agent')
    const client = as(TEST_USERS.admin)

    const bodies: Array<[unknown, string]> = [
      [{}, 'role_ids'],
      [{ role_ids: 'admin' }, 'role_ids'],
      [{ role_ids: ['x'] }, 'role_ids.0'],
      [{ role_ids: [987654] }, 'role_ids.0'],
    ]
    for (const [data, key] of bodies) {
      const visit = await client.visit('PUT', `${ADMIN}/users/${TEST_USERS.agent.id}/roles`, {
        data,
        referer: `${ADMIN}/users`,
      })
      assert.equal(visit.status, 302, JSON.stringify(visit.body))
      const page = await client.visit('GET', `${ADMIN}/users`)
      assert.deepEqual(Object.keys(page.body.flash?.errors ?? {}), [key], JSON.stringify(data))
    }

    const rows = await running.db.from('escalated_role_users').where('user_id', TEST_USERS.agent.id)
    assert.deepEqual(
      rows.map((row: any) => Number(row.role_id)),
      [await roleId('agent')]
    )
  })

  test('flashes "User updated." and 404s an unknown user', async ({ assert }) => {
    enforce()
    await giveRole(TEST_USERS.admin, 'admin')
    const client = as(TEST_USERS.admin)

    const saved = await client.visit('PUT', `${ADMIN}/users/${TEST_USERS.agent.id}/roles`, {
      data: { role_ids: [] },
      referer: `${ADMIN}/users`,
    })
    assert.equal(saved.status, 302)
    const page = await client.visit('GET', `${ADMIN}/users`)
    assert.equal(page.body.flash?.success, 'User updated.')

    const missing = await client.visit('PUT', `${ADMIN}/users/987654/roles`, {
      data: { role_ids: [] },
    })
    assert.equal(missing.status, 404)
  })
})
