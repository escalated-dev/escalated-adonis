import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from '../integration/helpers/app.js'
import { TEST_USERS } from '../integration/fixtures/user.js'
import { HOST_VIEWS } from './helpers.js'

/*
|--------------------------------------------------------------------------
| Embedded admin: iframe mode
|--------------------------------------------------------------------------
|
| ADR 2026-11-05-embeddable-admin, host type C. Embedded admin responses may
| be framed by the allow-listed origins: `frame-ancestors 'self' <origins>`
| and no `X-Frame-Options`, applied after every middleware, including a host
| middleware that sends `X-Frame-Options: DENY` and its own CSP on every
| response (`hostHeaders`, as @adonisjs/shield does). Other responses keep the
| host's headers untouched.
|
*/

test.group('Embedded admin (iframe mode)', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp({
      escalated: {
        ui: {
          enabled: true,
          embed: {
            enabled: true,
            mode: 'iframe',
            middleware: ['hostPanel', 'hostHeaders'],
            // Wildcards, `*`, paths and other schemes are dropped.
            frameAncestors:
              'https://allowed.example, *, https://*.example.com, https://allowed.example/path, ftp://files.example, https://second.example:8443',
          },
        },
      },
      inertia: { views: HOST_VIEWS, rootView: 'host_app' },
      routerMiddleware: [() => import('../integration/fixtures/embed/host_headers_middleware.js')],
    })
  })

  group.each.timeout(60_000)

  function as(user = TEST_USERS.admin) {
    return new InertiaClient(running.baseUrl, { user })
  }

  test('an embedded response may be framed by the listed origins only', async ({ assert }) => {
    const page = await as().visit('GET', '/admin/support/tags')

    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.isNull(page.headers.get('x-frame-options'))
    // The host's policy is kept; frame-ancestors is a second policy.
    assert.equal(
      page.headers.get('content-security-policy'),
      "default-src 'self', frame-ancestors 'self' https://allowed.example https://second.example:8443"
    )
  })

  test('the embed prop lists the allowed origins', async ({ assert }) => {
    const page = await as().visit('GET', '/admin/support/tags')

    assert.deepEqual(page.body.props.escalated.embed, {
      enabled: true,
      mode: 'iframe',
      layout: null,
      route: 'escalated.admin.tags.index',
      base_url: '/admin/support',
      allowed_origins: ['https://allowed.example', 'https://second.example:8443'],
    })
  })

  test('a refused embedded request is not marked embedded', async ({ assert }) => {
    const agent = await as(TEST_USERS.agent).visit('GET', '/admin/support/tags')

    assert.equal(agent.status, 403)
    assert.equal(agent.headers.get('x-frame-options'), 'DENY')
    assert.equal(agent.headers.get('content-security-policy'), "default-src 'self'")
  })

  test('other responses keep the host headers', async ({ assert }) => {
    const agentPage = await as().visit('GET', '/support/agent/tickets')

    assert.equal(agentPage.status, 200, JSON.stringify(agentPage.body))
    assert.equal(agentPage.headers.get('x-frame-options'), 'DENY')
    assert.equal(agentPage.headers.get('content-security-policy'), "default-src 'self'")
  })
})
