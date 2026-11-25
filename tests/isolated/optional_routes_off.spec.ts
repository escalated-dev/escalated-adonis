import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from '../integration/helpers/app.js'
import { routeTable } from '../integration/helpers/route_table.js'
import { TEST_USERS } from '../integration/fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Optional public routes switched off
|--------------------------------------------------------------------------
|
| `widget.enabled: false` and `guest.routesEnabled: false`: no widget route
| (embed.js, widget API, widget chat) and no guest portal route is
| registered. tests/integration/optional_routes_default.spec.ts covers the
| defaults, where they all exist.
|
*/

test.group('Optional public routes switched off', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp({
      escalated: {
        widget: { enabled: false },
        guest: { routesEnabled: false },
      },
    })
  })

  group.each.timeout(60_000)

  test('no widget or guest route is registered', async ({ assert }) => {
    const routes = routeTable(await running.app.container.make('router'))
    assert.isAbove(routes.length, 100)

    const optional = routes.filter(
      (route) =>
        /^escalated\.(widget|guest)\./.test(route.name ?? '') ||
        /^\/support\/(widget|guest)(\/|$)/.test(route.pattern)
    )
    assert.deepEqual(optional, [])

    // Everything else is still there.
    const names = routes.map((route) => route.name)
    assert.include(names, 'escalated.customer.tickets.index')
    assert.include(names, 'escalated.agent.tickets.show')
    assert.include(names, 'escalated.api.mobile.guest.verification')
  })

  test('their URLs answer 404', async ({ assert }) => {
    const anonymous = new InertiaClient(running.baseUrl)
    for (const [method, path] of [
      ['GET', '/support/widget/embed.js'],
      ['GET', '/support/widget/config'],
      ['POST', '/support/widget/tickets'],
      ['GET', '/support/widget/chat/availability'],
      ['GET', '/support/guest/create'],
      ['POST', '/support/guest'],
    ]) {
      const response = await anonymous.visit(method, path, {
        inertia: false,
        headers: { Accept: 'application/json' },
      })
      assert.equal(response.status, 404, `${method} ${path}`)
    }
  })

  test('the signed-in portal is unaffected', async ({ assert }) => {
    const response = await new InertiaClient(running.baseUrl, {
      user: TEST_USERS.customer,
    }).visit('GET', '/support')
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal(response.body.component, 'Escalated/Customer/Index')
  })
})
