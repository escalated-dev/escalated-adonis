import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from '../integration/helpers/app.js'
import { TEST_USERS, type TestUser } from '../integration/fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Staff-only portal: routes.customerMiddleware
|--------------------------------------------------------------------------
|
| An install only staff use adds a staff check to the customer portal and the
| customer knowledge base. The fixture kernel's `escalatedStaff` is the
| package's ensure_is_staff middleware, registered as docs/access-control.md
| tells a host to. A signed-in user who is not staff gets 403 there; staff
| still get through. Without the option (tests/integration) customers keep
| their portal.
|
*/

test.group('Staff-only portal (routes.customerMiddleware)', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp({
      escalated: {
        routes: {
          enabled: true,
          prefix: 'support',
          middleware: ['auth'],
          adminMiddleware: ['auth'],
          customerMiddleware: ['escalatedStaff'],
        },
      },
    })
    await running.db.from('escalated_settings').where('key', 'knowledge_base_enabled').delete()
    await running.db.table('escalated_settings').insert({
      key: 'knowledge_base_enabled',
      value: '1',
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
  })

  group.each.timeout(60_000)

  function as(user: TestUser) {
    return new InertiaClient(running.baseUrl, { user })
  }

  const CUSTOMER_ROUTES: Array<[string, string]> = [
    ['GET', '/support'],
    ['GET', '/support/create'],
    ['POST', '/support'],
    ['GET', '/support/kb'],
    ['GET', '/support/kb/some-article'],
  ]

  test('a signed-in user who is not staff gets 403 on customer and KB routes', async ({
    assert,
  }) => {
    for (const [method, path] of CUSTOMER_ROUTES) {
      const response = await as(TEST_USERS.customer).visit(method, path, {
        inertia: false,
        headers: { Accept: 'application/json' },
        data: method === 'POST' ? { subject: 'Hi', description: 'Hello' } : undefined,
      })
      assert.equal(response.status, 403, `${method} ${path}: ${JSON.stringify(response.body)}`)
    }
  })

  test('staff still reach the portal and the knowledge base', async ({ assert }) => {
    for (const user of [TEST_USERS.agent, TEST_USERS.admin]) {
      const index = await as(user).visit('GET', '/support')
      assert.equal(index.status, 200, JSON.stringify(index.body))
      assert.equal(index.body.component, 'Escalated/Customer/Index')

      const kb = await as(user).visit('GET', '/support/kb')
      assert.equal(kb.status, 200, JSON.stringify(kb.body))
    }
  })

  test('signed-out visitors are still turned away by routes.middleware', async ({ assert }) => {
    const response = await new InertiaClient(running.baseUrl).visit('GET', '/support', {
      inertia: false,
      headers: { Accept: 'application/json' },
    })
    assert.notEqual(response.status, 200)
  })
})
