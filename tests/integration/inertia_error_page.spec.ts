import { test } from '@japa/runner'
import { InertiaClient, testApp, TEST_USER_HEADER, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| The Escalated/Error page
|--------------------------------------------------------------------------
|
| A refusal or a failure inside the panel stays inside the panel. An Inertia
| visit that gets the host's error body back can only show it in a modal, so
| an Inertia visit to an Escalated route that ends in 403, 404, 419, 429, 500
| or 503 gets the shared frontend's Escalated/Error page, with the props Rails
| and Laravel send: the status and a generic message. Full page loads, JSON
| clients and the host's own routes are left to the host.
|
*/

const MESSAGES: Record<number, string> = {
  403: 'You are not authorized to perform this action.',
  404: 'The requested resource was not found.',
  419: 'Your session has expired. Refresh the page and try again.',
  429: 'Too many requests. Wait a moment and try again.',
  500: 'Something went wrong on our end.',
  503: 'The service is temporarily unavailable. Try again shortly.',
}

test.group('Escalated/Error page', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  function assertErrorPage(assert: any, visit: any, status: number) {
    assert.equal(visit.status, status, JSON.stringify(visit.body))
    assert.equal(visit.body.component, 'Escalated/Error')
    assert.deepEqual(visit.body.props, { status, message: MESSAGES[status] })
  }

  test('an Inertia visit refused by the admin gate gets the page', async ({ assert }) => {
    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })

    const visit = await client.visit('GET', '/support/admin/settings')

    assertErrorPage(assert, visit, 403)
    assert.notInclude(JSON.stringify(visit.body), 'support administrator')
  })

  test('an Inertia visit to a missing ticket gets the page', async ({ assert }) => {
    const client = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })

    const visit = await client.visit('GET', '/support/agent/tickets/NOPE-404')

    assertErrorPage(assert, visit, 404)
    assert.notInclude(JSON.stringify(visit.body), 'Row not found')
  })

  for (const status of [403, 404, 419, 429, 500, 503]) {
    test(`a thrown ${status} on an Escalated route gets the page`, async ({ assert }) => {
      const client = new InertiaClient(running.baseUrl)

      const visit = await client.visit('GET', `/support/__probe/${status}`)

      assertErrorPage(assert, visit, status)
      const body = JSON.stringify(visit.body)
      assert.notInclude(body, 'upstream detail')
      assert.notInclude(body, 'escalated_secret_table')
    })
  }

  for (const status of [419, 429, 503]) {
    test(`a ${status} response on an Escalated route gets the page`, async ({ assert }) => {
      const client = new InertiaClient(running.baseUrl)

      const visit = await client.visit('GET', `/support/__probe/${status}?respond=1`)

      assertErrorPage(assert, visit, status)
      assert.notInclude(JSON.stringify(visit.body), 'upstream detail')
    })
  }

  test('other statuses are passed through', async ({ assert }) => {
    const client = new InertiaClient(running.baseUrl)

    const visit = await client.visit('GET', '/support/__probe/422')

    assert.equal(visit.status, 422)
    assert.notEqual(visit.body.component, 'Escalated/Error')
  })

  test('a 500 is left to the host handler while the app runs in development', async ({
    assert,
  }) => {
    Object.defineProperty(running.app, 'inDev', { get: () => true, configurable: true })
    try {
      const visit = await new InertiaClient(running.baseUrl).visit('GET', '/support/__probe/500')

      assert.equal(visit.status, 500)
      assert.notEqual(visit.body.component, 'Escalated/Error')
    } finally {
      delete (running.app as any).inDev
    }
  })

  test('a full page load is left to the host', async ({ assert }) => {
    const response = await fetch(`${running.baseUrl}/support/admin/settings`, {
      headers: { [TEST_USER_HEADER]: String(TEST_USERS.agent.id), Accept: 'text/html' },
    })

    assert.equal(response.status, 403)
    assert.notInclude(await response.text(), 'Escalated/Error')
  })

  test('a JSON request is left to the host', async ({ assert }) => {
    const response = await fetch(`${running.baseUrl}/support/__probe/500`, {
      headers: { Accept: 'application/json' },
    })

    assert.equal(response.status, 500)
    assert.notInclude(await response.text(), 'Escalated/Error')
  })

  test('an Inertia visit to a host route is left to the host', async ({ assert }) => {
    const visit = await new InertiaClient(running.baseUrl).visit('GET', '/__test/host-missing')

    assert.equal(visit.status, 404)
    assert.deepEqual(visit.body, { error: 'host page' })
  })
})
