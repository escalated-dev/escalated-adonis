import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS, type TestUser } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Route middleware
|--------------------------------------------------------------------------
|
| Every guarded route group attached its middleware as a lazy import,
| `() => import('../src/middleware/ensure_is_admin.js')`. AdonisJS 7 runs a
| bare function in a middleware stack as `(ctx, next)`, so the "middleware" was
| the import itself: it resolved to a module, never called `next()`, and the
| request ended in an empty 200 without reaching its controller. That took down
| every admin, agent and API route.
|
| These tests go through the booted application with the host's own `auth`
| middleware named in config, the way `config/escalated.ts` names it.
|
*/

test.group('Route middleware', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  function as(user: TestUser | null) {
    return new InertiaClient(running.baseUrl, { user })
  }

  // ---- Admin ---------------------------------------------------------------

  test('an admin page runs its controller for an admin', async ({ assert }) => {
    const page = await as(TEST_USERS.admin).visit('GET', '/support/admin/automations/create')

    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.equal(page.body.component, 'Escalated/Admin/Automations/Form')
  })

  test('an admin page refuses a signed-in agent', async ({ assert }) => {
    const page = await as(TEST_USERS.agent).visit('GET', '/support/admin/automations/create')

    assert.equal(page.status, 403, JSON.stringify(page.body))
    assert.isString(page.body.error)
  })

  test('the host auth middleware named in config runs before the admin check', async ({
    assert,
  }) => {
    const page = await as(null).visit('GET', '/support/admin/automations/create')

    assert.equal(page.status, 401, JSON.stringify(page.body))
    assert.equal(page.body.error, 'Sign in first.')
  })

  // ---- Agent ---------------------------------------------------------------

  test('an agent route runs its controller for an agent', async ({ assert }) => {
    const response = await as(TEST_USERS.agent).visit('GET', '/support/agent/chats/queue')

    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.isArray(response.body.queue)
  })

  test('an agent route refuses a customer', async ({ assert }) => {
    const response = await as(TEST_USERS.customer).visit('GET', '/support/agent/chats/queue')

    assert.equal(response.status, 403, JSON.stringify(response.body))
    assert.isString(response.body.error)
  })

  test('a ticket route resolves its ticket before the controller runs', async ({ assert }) => {
    const response = await as(TEST_USERS.agent).visit('GET', '/support/agent/tickets/NO-SUCH-1')

    assert.equal(response.status, 404, JSON.stringify(response.body))
  })

  // ---- API -----------------------------------------------------------------

  test('an API route runs its controller for a valid token, through the rate limiter', async ({
    assert,
  }) => {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(
      { id: TEST_USERS.agent.id, constructor: { name: 'User' } },
      'route middleware test'
    )

    const response = await as(null).visit('GET', '/support/api/v1/tags', {
      headers: { Authorization: `Bearer ${plainTextToken}` },
    })

    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.isArray(response.body.data)
    assert.equal(response.headers.get('x-ratelimit-limit'), '1000')
  })

  test('an API route refuses a request without a token', async ({ assert }) => {
    const response = await as(null).visit('GET', '/support/api/v1/tags')

    assert.equal(response.status, 401, JSON.stringify(response.body))
    assert.equal(response.body.message, 'Unauthenticated.')
  })

  // ---- Config ----------------------------------------------------------------

  test('a middleware name the host kernel does not define fails at boot, naming it', async ({
    assert,
  }) => {
    const { resolveConfiguredMiddleware } = await import('../../src/support/route_middleware.js')

    await assert.rejects(
      () =>
        resolveConfiguredMiddleware(['auth', 'sso'], 'routes.adminMiddleware', async () => ({
          middleware: { auth: () => ({}) },
        })),
      /routes\.adminMiddleware.*"sso"/
    )
  })
})
