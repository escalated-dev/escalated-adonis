import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Roles and agent capacity pages
|--------------------------------------------------------------------------
|
| The roles, permissions and agent capacity tables existed, and the newsletter
| permission check already reads roles, but there was no screen for either.
| These render the shared Admin/Roles/* and Admin/Capacity/Index pages with
| the props escalated-laravel's RoleController and CapacityController pass,
| and accept the writes those pages post.
|
*/

const ROLES = '/support/admin/roles'
const CAPACITY = '/support/admin/capacity'

test.group('Roles and capacity pages', (group) => {
  let running: TestApp
  let client: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    client = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
    await running.db.from('escalated_role_users').delete()
    await running.db.from('escalated_role_permissions').delete()
    await running.db.from('escalated_roles').delete()
    await running.db.from('escalated_permissions').delete()
    await running.db.from('escalated_agent_capacity').delete()
  })

  group.each.timeout(30_000)

  async function permission(slug: string, groupName: string) {
    const [id] = await running.db.table('escalated_permissions').insert({
      name: slug,
      slug,
      group: groupName,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    return Number(id)
  }

  async function role(name: string, slug: string, isSystem = false) {
    const [id] = await running.db.table('escalated_roles').insert({
      name,
      slug,
      description: `${name} role`,
      is_system: isSystem,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    return Number(id)
  }

  // ---- Roles ------------------------------------------------------------------

  test('index renders Roles/Index with users_count and is_system', async ({ assert }) => {
    const agentRole = await role('Agent', 'agent')
    await role('Admin', 'admin', true)
    await running.db.table('escalated_role_users').insert([
      { role_id: agentRole, user_id: TEST_USERS.agent.id },
      { role_id: agentRole, user_id: TEST_USERS.admin.id },
    ])

    const visit = await client.visit('GET', ROLES)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Roles/Index')
    const rows = visit.body.props.roles
    const agent = rows.find((r: any) => r.id === agentRole)
    assert.equal(agent.name, 'Agent')
    assert.equal(agent.description, 'Agent role')
    assert.equal(agent.users_count, 2)
    assert.isFalse(agent.is_system)
    assert.isTrue(rows.find((r: any) => r.slug === 'admin').is_system)
  })

  test('create renders Roles/Form with permissions grouped by group', async ({ assert }) => {
    const view = await permission('ticket.view', 'Tickets')
    await permission('reply.create', 'Replies')

    const visit = await client.visit('GET', `${ROLES}/create`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Roles/Form')
    const { permissions } = visit.body.props
    assert.sameMembers(Object.keys(permissions), ['Tickets', 'Replies'])
    assert.equal(permissions.Tickets[0].id, view)
    assert.equal(permissions.Tickets[0].slug, 'ticket.view')
    assert.equal(permissions.Tickets[0].name, 'ticket.view')
    assert.notExists(visit.body.props.role)
  })

  test('edit renders Roles/Form with the role and its permissions', async ({ assert }) => {
    const view = await permission('ticket.view', 'Tickets')
    const id = await role('Agent', 'agent')
    await running.db
      .table('escalated_role_permissions')
      .insert({ role_id: id, permission_id: view })

    const visit = await client.visit('GET', `${ROLES}/${id}/edit`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Roles/Form')
    const props = visit.body.props
    assert.equal(props.role.id, id)
    assert.equal(props.role.name, 'Agent')
    assert.equal(props.role.description, 'Agent role')
    assert.deepEqual(
      props.role.permissions.map((p: any) => p.id),
      [view]
    )
    assert.property(props.permissions, 'Tickets')
  })

  test('store creates the role with its permissions and redirects to the index', async ({
    assert,
  }) => {
    const view = await permission('ticket.view', 'Tickets')

    const visit = await client.visit('POST', ROLES, {
      data: { name: 'Billing Team', description: 'Handles invoices', permissions: [view] },
      referer: `${ROLES}/create`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, ROLES)
    const row = await running.db.from('escalated_roles').where('name', 'Billing Team').first()
    assert.equal(row.slug, 'billing-team')
    assert.equal(row.description, 'Handles invoices')
    const links = await running.db.from('escalated_role_permissions').where('role_id', row.id)
    assert.deepEqual(
      links.map((l: any) => Number(l.permission_id)),
      [view]
    )
  })

  test('store without a name goes back with an error', async ({ assert }) => {
    const visit = await client.visit('POST', ROLES, {
      data: { name: '', permissions: [] },
      referer: `${ROLES}/create`,
    })

    assert.equal(visit.status, 302)
    assert.equal(visit.location, `${ROLES}/create`)
    assert.lengthOf(await running.db.from('escalated_roles'), 0)
  })

  test('store gives a second role with the same name its own slug', async ({ assert }) => {
    await role('Agent', 'agent')

    await client.visit('POST', ROLES, { data: { name: 'Agent' }, referer: `${ROLES}/create` })

    const rows = await running.db.from('escalated_roles').orderBy('id')
    const slugs = rows.map((r: any) => r.slug)
    assert.deepEqual(slugs, ['agent', 'agent-2'])
  })

  test('update renames the role and syncs permissions', async ({ assert }) => {
    const view = await permission('ticket.view', 'Tickets')
    const reply = await permission('reply.create', 'Replies')
    const id = await role('Agent', 'agent')
    await running.db
      .table('escalated_role_permissions')
      .insert({ role_id: id, permission_id: view })

    const visit = await client.visit('PUT', `${ROLES}/${id}`, {
      data: { name: 'Senior Agent', description: '', permissions: [reply] },
      referer: `${ROLES}/${id}/edit`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, ROLES)
    const row = await running.db.from('escalated_roles').where('id', id).first()
    assert.equal(row.name, 'Senior Agent')
    assert.equal(row.slug, 'agent')
    const links = await running.db.from('escalated_role_permissions').where('role_id', id)
    assert.deepEqual(
      links.map((l: any) => Number(l.permission_id)),
      [reply]
    )
  })

  test('update ignores permission ids that do not exist', async ({ assert }) => {
    const id = await role('Agent', 'agent')

    await client.visit('PUT', `${ROLES}/${id}`, {
      data: { name: 'Agent', permissions: [424242] },
      referer: `${ROLES}/${id}/edit`,
    })

    assert.lengthOf(await running.db.from('escalated_role_permissions').where('role_id', id), 0)
  })

  test('destroy deletes a role but refuses a system role', async ({ assert }) => {
    const custom = await role('Custom', 'custom')
    const system = await role('Admin', 'admin', true)

    const deleted = await client.visit('DELETE', `${ROLES}/${custom}`, { referer: ROLES })
    assert.equal(deleted.status, 302)
    assert.equal(deleted.location, ROLES)

    const refused = await client.visit('DELETE', `${ROLES}/${system}`, { referer: ROLES })
    assert.equal(refused.status, 302)
    const after = await client.visit('GET', ROLES)
    assert.equal(after.body.flash.error, 'System roles cannot be deleted.')

    const left = await running.db.from('escalated_roles')
    const remaining = left.map((r: any) => r.slug)
    assert.deepEqual(remaining, ['admin'])
  })

  test('roles pages are admin only', async ({ assert }) => {
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    const visit = await agent.visit('GET', ROLES)
    assert.notEqual(visit.status, 200)
  })

  // ---- Capacity ---------------------------------------------------------------

  test('capacity index renders Capacity/Index with each agent row', async ({ assert }) => {
    await running.db.table('escalated_agent_capacity').insert({
      user_id: TEST_USERS.agent.id,
      channel: 'email',
      max_concurrent: 4,
      current_count: 1,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })

    const visit = await client.visit('GET', CAPACITY)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Admin/Capacity/Index')
    const [row] = visit.body.props.capacities
    assert.isNumber(row.id)
    assert.equal(row.user_id, TEST_USERS.agent.id)
    assert.equal(row.agent_name, TEST_USERS.agent.name)
    assert.equal(row.channel, 'email')
    assert.equal(row.max_concurrent, 4)
    assert.equal(row.current_count, 1)
    assert.equal(row.load_percentage, 25)
  })

  test('capacity update sets max_concurrent and goes back', async ({ assert }) => {
    const [id] = await running.db.table('escalated_agent_capacity').insert({
      user_id: TEST_USERS.agent.id,
      channel: 'default',
      max_concurrent: 4,
      current_count: 0,
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })

    const visit = await client.visit('PUT', `${CAPACITY}/${id}`, {
      data: { max_concurrent: 12 },
      referer: CAPACITY,
    })
    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, CAPACITY)
    const row = await running.db.from('escalated_agent_capacity').where('id', id).first()
    assert.equal(Number(row.max_concurrent), 12)

    const invalid = await client.visit('PUT', `${CAPACITY}/${id}`, {
      data: { max_concurrent: 0 },
      referer: CAPACITY,
    })
    assert.equal(invalid.status, 302)
    const unchanged = await running.db.from('escalated_agent_capacity').where('id', id).first()
    assert.equal(Number(unchanged.max_concurrent), 12)
  })
})
