import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Switching the widget off
|--------------------------------------------------------------------------
|
| `widget_enabled` gates the widget, but the admin settings form neither
| showed nor saved it, so an admin had no way to switch the widget off.
| Laravel's SettingsController reads and saves it; so does this one now. The
| default stays on, so existing installs keep their widget.
|
*/

test.group('Widget settings', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
  })

  group.each.timeout(30_000)

  group.each.setup(() => async () => {
    const { default: EscalatedSetting } = await import('../../src/models/escalated_setting.js')
    await EscalatedSetting.set('widget_enabled', '1')
  })

  function admin() {
    return new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
  }

  test('the settings page shows widget_enabled', async ({ assert }) => {
    const page = await admin().visit('GET', '/support/admin/settings')

    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.equal(page.body.props.settings.widget_enabled, true)
  })

  test('an admin can switch the widget off and on again', async ({ assert }) => {
    const client = admin()
    const saved = await client.visit('POST', '/support/admin/settings', {
      data: { widget_enabled: false },
      referer: '/support/admin/settings',
    })
    assert.oneOf(saved.status, [302, 303], JSON.stringify(saved.body))

    const page = await client.visit('GET', '/support/admin/settings')
    assert.equal(page.body.props.settings.widget_enabled, false)

    const config = await fetch(`${running.baseUrl}/support/widget/config`, {
      headers: { Accept: 'application/json' },
    })
    assert.equal(config.status, 403)

    await client.visit('POST', '/support/admin/settings', {
      data: { widget_enabled: true },
      referer: '/support/admin/settings',
    })
    const again = await client.visit('GET', '/support/admin/settings')
    assert.equal(again.body.props.settings.widget_enabled, true)
  })
})
