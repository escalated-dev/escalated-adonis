import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from '../integration/helpers/app.js'
import { TEST_USERS } from '../integration/fixtures/user.js'
import { HOST_VIEWS } from './helpers.js'

/*
|--------------------------------------------------------------------------
| Embedded admin: a server-rendered (Edge) host
|--------------------------------------------------------------------------
|
| ADR 2026-11-05-embeddable-admin, host type B: `ui.embed.rootView` names the
| host's admin template (fixtures/embed/views/admin/escalated.edge, the one in
| docs/embedding-admin.md). Embedded admin pages render in it, with the host
| chrome, the admin menu (`escalatedNavigation`) and the Inertia mount point;
| every other page keeps the host's root view (`host_app`).
|
*/

test.group('Embedded admin (Edge root view)', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp({
      escalated: {
        ui: {
          enabled: true,
          embed: {
            enabled: true,
            prefix: 'admin/support',
            middleware: ['auth'],
            rootView: 'admin/escalated',
          },
        },
      },
      inertia: { views: HOST_VIEWS, rootView: 'host_app' },
    })
  })

  group.each.timeout(60_000)

  function page(path: string, user = TEST_USERS.admin) {
    return new InertiaClient(running.baseUrl, { user }).visit('GET', path, { inertia: false })
  }

  test('a first visit to an embedded admin page renders in the host admin template', async ({
    assert,
  }) => {
    const response = await page('/admin/support/tags')

    assert.equal(response.status, 200, String(response.body))
    const html = String(response.body)
    assert.include(html, 'data-root-view="admin/escalated"')
    assert.include(html, '<header class="admin-header">Acme admin</header>')
    // The admin menu, from adminNavigation(), with the current page marked.
    assert.include(
      html,
      '<a href="/admin/support/tags" class="active" aria-current="page">Tags</a>'
    )
    assert.include(html, '<a href="/admin/support/reports">Reports</a>')
    // The Inertia mount point, with the embedded page.
    assert.include(html, '<div id="app"></div>')
    const data = /<script data-page="app" type="application\/json">(.*?)<\/script>/s.exec(html)
    assert.exists(data)
    const pageObject = JSON.parse(data![1])
    assert.equal(pageObject.component, 'Escalated/Admin/Tags/Index')
    assert.isTrue(pageObject.props.escalated.embed.enabled)
  })

  test('every other page keeps the host root view', async ({ assert }) => {
    const agent = await page('/support/agent/tickets')
    assert.equal(agent.status, 200, String(agent.body))
    assert.include(String(agent.body), 'data-root-view="host_app"')
    assert.notInclude(String(agent.body), 'Acme admin')
  })

  test('an Inertia visit to an embedded page is the page object, not the template', async ({
    assert,
  }) => {
    const visit = await new InertiaClient(running.baseUrl, { user: TEST_USERS.admin }).visit(
      'GET',
      '/admin/support/tags'
    )
    assert.equal(visit.status, 200)
    assert.equal(visit.body.component, 'Escalated/Admin/Tags/Index')
  })

  test('the template in docs/embedding-admin.md is this one', async ({ assert }) => {
    const template = readFileSync(join(HOST_VIEWS, 'admin', 'escalated.edge'), 'utf8')
    const docs = readFileSync(new URL('../../docs/embedding-admin.md', import.meta.url), 'utf8')

    const lf = (text: string) => text.split('\r\n').join('\n')
    assert.include(lf(docs), lf(template).trim())
  })
})
