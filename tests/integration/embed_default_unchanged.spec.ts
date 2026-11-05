import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { routeTable } from './helpers/route_table.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Embedding the admin is off by default
|--------------------------------------------------------------------------
|
| ADR 2026-11-05-embeddable-admin: with no `ui.embed` configuration every
| route, middleware, prop and header is what it was before the feature
| existed. `fixtures/embed/default-routes.json` is the route table of this
| suite's application taken from `main` before the change; the live table
| must match it exactly. Regenerate it only for a deliberate route change:
| `ESCALATED_UPDATE_ROUTE_SNAPSHOT=1 node --import=tsx bin/test.ts --files=tests/integration/embed_default_unchanged.spec.ts`.
|
*/

const SNAPSHOT = fileURLToPath(new URL('./fixtures/embed/default-routes.json', import.meta.url))

test.group('Embedding the admin: off by default', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  test('the route table is the one from before the feature', async ({ assert }) => {
    const router = await running.app.container.make('router')
    const live = routeTable(router)

    if (process.env.ESCALATED_UPDATE_ROUTE_SNAPSHOT) {
      writeFileSync(SNAPSHOT, JSON.stringify(live, null, 2) + '\n')
    }

    const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'))
    assert.isAbove(snapshot.length, 300)
    assert.deepEqual(live, snapshot)
  })

  test('the admin answers at /support/admin with its own gate', async ({ assert }) => {
    const admin = await new InertiaClient(running.baseUrl, { user: TEST_USERS.admin }).visit(
      'GET',
      '/support/admin/tags'
    )
    assert.equal(admin.status, 200, JSON.stringify(admin.body))
    assert.equal(admin.body.component, 'Escalated/Admin/Tags/Index')

    const agent = await new InertiaClient(running.baseUrl, { user: TEST_USERS.agent }).visit(
      'GET',
      '/support/admin/tags'
    )
    assert.equal(agent.status, 403)

    const embedded = await new InertiaClient(running.baseUrl, { user: TEST_USERS.admin }).visit(
      'GET',
      '/admin/support/tags'
    )
    assert.equal(embedded.status, 404)
  })
})
