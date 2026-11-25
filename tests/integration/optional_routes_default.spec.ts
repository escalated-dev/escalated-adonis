import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { routeTable } from './helpers/route_table.js'
import { TEST_USERS } from './fixtures/user.js'

/*
 * With `widget.enabled`, `guest.routesEnabled` and
 * `routes.customerMiddleware` unset, the widget and guest routes exist and
 * customers keep their portal, as before those options existed
 * (embed_default_unchanged.spec.ts pins the whole route table).
 * tests/isolated covers the options set.
 */

test.group('Optional routes: defaults', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(60_000)

  test('the widget and guest routes are registered', async ({ assert }) => {
    const names = routeTable(await running.app.container.make('router')).map((r) => r.name)
    for (const name of [
      'escalated.widget.script',
      'escalated.widget.config',
      'escalated.widget.tickets.create',
      'escalated.widget.chat.start',
      'escalated.guest.tickets.create',
      'escalated.guest.tickets.store',
      'escalated.guest.tickets.show',
    ]) {
      assert.include(names, name)
    }
  })

  test('a customer reaches the portal', async ({ assert }) => {
    const response = await new InertiaClient(running.baseUrl, {
      user: TEST_USERS.customer,
    }).visit('GET', '/support')
    assert.equal(response.status, 200, JSON.stringify(response.body))
    assert.equal(response.body.component, 'Escalated/Customer/Index')
  })
})
