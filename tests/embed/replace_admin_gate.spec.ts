import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from '../integration/helpers/app.js'
import { routeTable } from '../integration/helpers/route_table.js'
import { setAccess } from '../integration/helpers/access.js'
import { TEST_USERS, type TestUser } from '../integration/fixtures/user.js'
import { HOST_VIEWS, routeMiddleware } from './helpers.js'

/*
|--------------------------------------------------------------------------
| Embedded admin: the host replaces Escalated's admin gate
|--------------------------------------------------------------------------
|
| ADR 2026-11-05-embeddable-admin. With `replaceAdminGate`, the host's
| middleware (`hostPanel`: any non-customer) alone decides who reaches the
| embedded admin. Two-factor and route permissions still apply, and the agent
| panel keeps Escalated's own gates.
|
*/

test.group('Embedded admin (host replaces the admin gate)', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp({
      escalated: {
        ui: {
          enabled: true,
          embed: {
            enabled: true,
            prefix: '/backoffice/helpdesk/',
            middleware: ['hostPanel'],
            replaceAdminGate: true,
          },
        },
      },
      inertia: { views: HOST_VIEWS, rootView: 'host_app' },
    })
  })

  group.each.setup(async () => {
    setAccess({})
    return () => setAccess(undefined)
  })

  group.each.timeout(60_000)

  function as(user: TestUser) {
    return new InertiaClient(running.baseUrl, { user })
  }

  test('the host middleware alone decides who reaches the admin', async ({ assert }) => {
    // An agent is not an Escalated admin, but the host lets its staff in.
    const agent = await as(TEST_USERS.agent).visit('GET', '/backoffice/helpdesk/tags')
    assert.equal(agent.status, 200, JSON.stringify(agent.body))
    assert.equal(agent.body.component, 'Escalated/Admin/Tags/Index')

    const customer = await as(TEST_USERS.customer).visit('GET', '/backoffice/helpdesk/tags', {
      inertia: false,
      headers: { Accept: 'application/json' },
    })
    assert.equal(customer.status, 403)
    assert.equal(customer.body.error, 'Host panel: staff only.')
  })

  test('the embedded routes carry no admin gate, and keep two-factor and permissions', async ({
    assert,
  }) => {
    const router = await running.app.container.make('router')
    const tags = routeTable(router).find((row) => row.name === 'escalated.admin.tags.index')

    assert.equal(tags?.pattern, '/backoffice/helpdesk/tags')
    assert.deepEqual(routeMiddleware(tags!), [
      'hostPanel',
      'requireTwoFactor',
      'enforceRoutePermissions',
      'ticketAccess',
      'applyEmbedContext',
    ])
  })

  test('route permissions still apply', async ({ assert }) => {
    setAccess({ rolesPermissions: true })

    const agent = await as(TEST_USERS.agent).visit('GET', '/backoffice/helpdesk/tags')
    assert.equal(agent.status, 403, JSON.stringify(agent.body))
  })

  test('the agent panel keeps Escalated gates', async ({ assert }) => {
    const customer = await as(TEST_USERS.customer).visit('GET', '/support/agent/tickets')
    assert.equal(customer.status, 403)

    const agent = await as(TEST_USERS.agent).visit('GET', '/support/agent/tickets')
    assert.equal(agent.status, 200, JSON.stringify(agent.body))
    // The host decides who sees its sidebar: the menu is built for any signed-in user.
    assert.isAbove(agent.body.props.escalated.navigation.length, 10)
    assert.isFalse(agent.body.props.escalated.is_admin)
    assert.equal(agent.body.props.escalated.embed.base_url, '/backoffice/helpdesk')
  })
})
