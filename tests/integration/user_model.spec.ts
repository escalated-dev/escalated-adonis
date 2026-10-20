import { test } from '@japa/runner'
import { testApp, type TestApp } from './helpers/app.js'
import User, { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| The host's user model
|--------------------------------------------------------------------------
|
| The config stub's default is `userModel: '#models/user'`, an alias in the
| host's package.json `imports`. Node resolves `#` specifiers against the
| package.json nearest the importing file, so `import('#models/user')` written
| inside this package threw ERR_PACKAGE_IMPORT_NOT_DEFINED: every API token
| answered 401, inbound replies from registered customers never threaded, and
| restricted ticket access failed with 500.
|
| The test application uses that alias (see helpers/app.ts), resolved by the
| fixtures' own `imports` map through the host importer, as a real host does.
|
*/

test.group('Host user model', (group) => {
  let running: TestApp
  let previous: unknown

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(() => {
    previous = (getConfig() as any).userModel
    return () => {
      ;(getConfig() as any).userModel = previous
    }
  })

  group.each.timeout(30_000)

  async function helper() {
    return import('../../src/support/user_model.js')
  }

  test('the stub default "#models/user" resolves through the host import map', async ({
    assert,
  }) => {
    assert.equal((getConfig() as any).userModel, '#models/user')
    const { resolveUserModel, findHostUser, userModelTypeName } = await helper()

    assert.strictEqual(await resolveUserModel(), User)
    assert.strictEqual(await findHostUser(TEST_USERS.agent.id), TEST_USERS.agent)
    assert.equal(await userModelTypeName(), 'User')
  })

  test('the alias does not resolve from inside the package itself', async ({ assert }) => {
    // The bug this guards against: a bare import from package code.
    await assert.rejects(() => import('#models/user' as string))
  })

  test('a bare class name is read as #models/<snake_case>', async ({ assert }) => {
    ;(getConfig() as any).userModel = 'User'
    const { resolveUserModel } = await helper()

    assert.strictEqual(await resolveUserModel(), User)
  })

  test('a loader written in the host config resolves', async ({ assert }) => {
    ;(getConfig() as any).userModel = () => Promise.resolve({ default: User })
    const { resolveUserModel } = await helper()

    assert.strictEqual(await resolveUserModel(), User)
  })

  test('the model class itself is accepted', async ({ assert }) => {
    ;(getConfig() as any).userModel = User
    const { resolveUserModel } = await helper()

    assert.strictEqual(await resolveUserModel(), User)
  })

  test('an unresolvable model names the setting', async ({ assert }) => {
    ;(getConfig() as any).userModel = '#models/nobody'
    const { resolveUserModel } = await helper()

    await assert.rejects(() => resolveUserModel(), /config\.userModel \("#models\/nobody"\)/)
  })

  test('an API token owned by a host user authenticates with the alias config', async ({
    assert,
  }) => {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(TEST_USERS.admin, 'alias', ['*'], null)

    const response = await fetch(`${running.baseUrl}/support/api/v1/auth/validate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${plainTextToken}`, Accept: 'application/json' },
    })

    assert.equal(response.status, 200, await response.text())
  })
})
