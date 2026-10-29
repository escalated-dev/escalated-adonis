import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { Secret, TOTP } from 'otpauth'
import { InertiaClient, sqlTimestamp, testApp, type TestApp, type Visit } from './helpers/app.js'
import { TEST_USERS, type TestUser } from './fixtures/user.js'
import { setAccess } from './helpers/access.js'

/*
|--------------------------------------------------------------------------
| Two-factor authentication behind an install-level switch
|--------------------------------------------------------------------------
|
| ADR 2026-10-29-configurable-access-features. Staff could enrol in TOTP, but
| no sign-in ever asked for the code and nothing rendered the challenge page.
|
| `access.twoFactor` (ESCALATED_TWO_FACTOR) now decides. Off, the default: the
| enrolment and challenge routes answer 404 and nobody is challenged. On: a
| staff user with a confirmed enrolment passes Auth/TwoFactorChallenge once
| per login before any admin or agent route, and admins can require every
| staff user to enrol.
|
*/

const ADMIN = '/support/admin'
const AGENT = '/support/agent'
const API = '/support/api/v1'
const CHALLENGE = '/support/two-factor/challenge'
const ENROL = `${ADMIN}/settings/two-factor`

const RECOVERY_CODES = ['AAAA1111-BBBB2222', 'CCCC3333-DDDD4444']

test.group('Two-factor authentication', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    setAccess({})
    delete (globalThis as any).__escalated_config.twoFactor
    await running.db.from('escalated_two_factor').delete()
    await running.db.from('escalated_settings').where('key', 'two_factor_required').delete()
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
    const { twoFactorRateLimitStore } = await import('../../src/support/two_factor_session.js')
    twoFactorRateLimitStore.clear()
    return async () => {
      setAccess(undefined)
      delete (globalThis as any).__escalated_config.twoFactor
      await running.db.from('escalated_two_factor').delete()
      await running.db.from('escalated_settings').where('key', 'two_factor_required').delete()
    }
  })

  group.each.timeout(60_000)

  // ---- Helpers ------------------------------------------------------------------

  function as(user: TestUser) {
    return new InertiaClient(running.baseUrl, { user })
  }

  function enforce() {
    setAccess({ twoFactor: true })
  }

  function requireEnrolment() {
    ;(globalThis as any).__escalated_config.twoFactor = { required: true }
  }

  /** A confirmed enrolment for the user with a known secret and recovery codes. */
  async function enrol(user: TestUser) {
    const { default: TwoFactor } = await import('../../src/models/two_factor.js')
    const { default: TwoFactorService } = await import('../../src/services/two_factor_service.js')
    const service = new TwoFactorService()
    const secret = new Secret({ size: 20 }).base32
    await TwoFactor.create({
      userId: user.id,
      secret,
      recoveryCodes: RECOVERY_CODES.map((code) => service.hashRecoveryCode(code)),
      confirmedAt: DateTime.now(),
    } as any)
    return secret
  }

  function codeFor(secret: string, steps = 0) {
    return new TOTP({ secret: Secret.fromBase32(secret) }).generate({
      timestamp: Date.now() + steps * 30_000,
    })
  }

  /** The host signs the user in again: its session guard emits login_succeeded. */
  async function signInAgain(client: InertiaClient) {
    const visit = await client.visit('POST', '/__test/login', { data: {} })
    if (visit.status !== 200) throw new Error(`test login failed: ${JSON.stringify(visit.body)}`)
  }

  async function passChallenge(client: InertiaClient, secret: string) {
    const visit = await client.visit('POST', CHALLENGE, {
      data: { code: codeFor(secret) },
      referer: CHALLENGE,
    })
    if (visit.status !== 302 || visit.location === CHALLENGE) {
      throw new Error(`challenge not passed: ${visit.status} ${JSON.stringify(visit.body)}`)
    }
  }

  async function shared(user: TestUser) {
    const { escalatedSharedData } = await import('../../src/support/shared_data.js')
    return escalatedSharedData({ auth: { user } })
  }

  async function statusOf(visit: Promise<Visit>) {
    const result = await visit
    return result.status
  }

  async function locationOf(visit: Promise<Visit>) {
    const result = await visit
    return result.location
  }

  async function featureOn(user: TestUser): Promise<boolean> {
    const data = await shared(user)
    return data.features.two_factor
  }

  async function mustEnrol(user: TestUser): Promise<boolean> {
    const data = await shared(user)
    return data.two_factor_required
  }

  async function tokenFor(owner: TestUser) {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(
      { id: owner.id, constructor: { name: 'User' } },
      'two-factor',
      ['agent', 'admin']
    )
    return plainTextToken
  }

  // ---- Switch off (the default) -------------------------------------------------

  test('is off by default: enrolled staff are not challenged and its routes answer 404', async ({
    assert,
  }) => {
    await enrol(TEST_USERS.admin)
    await enrol(TEST_USERS.agent)

    const admin = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/tags`)
    assert.equal(admin.status, 200, JSON.stringify(admin.body))
    const agent = await as(TEST_USERS.agent).visit('GET', `${AGENT}/tickets`)
    assert.equal(agent.status, 200, JSON.stringify(agent.body))

    for (const [method, path] of [
      ['GET', ENROL],
      ['POST', `${ENROL}/setup`],
      ['POST', `${ENROL}/confirm`],
      ['POST', `${ENROL}/disable`],
      ['GET', CHALLENGE],
      ['POST', CHALLENGE],
    ]) {
      for (const user of [TEST_USERS.admin, TEST_USERS.agent]) {
        const visit = await as(user).visit(method, path, {
          data: method === 'GET' ? undefined : {},
        })
        assert.equal(visit.status, 404, `${method} ${path}: ${JSON.stringify(visit.body)}`)
      }
    }

    const data = await shared(TEST_USERS.admin)
    assert.isFalse(data.features.two_factor)
    assert.isFalse(data.two_factor_required)
  })

  test('reads the switch from config, or ESCALATED_TWO_FACTOR when config leaves it unset', async ({
    assert,
  }) => {
    setAccess(undefined)
    const previous = process.env.ESCALATED_TWO_FACTOR
    try {
      process.env.ESCALATED_TWO_FACTOR = 'true'
      assert.isTrue(await featureOn(TEST_USERS.admin))
      const page = await as(TEST_USERS.admin).visit('GET', ENROL)
      assert.equal(page.status, 200, JSON.stringify(page.body))

      // An explicit config value wins over the environment.
      setAccess({ twoFactor: false })
      assert.isFalse(await featureOn(TEST_USERS.admin))
    } finally {
      if (previous === undefined) delete process.env.ESCALATED_TWO_FACTOR
      else process.env.ESCALATED_TWO_FACTOR = previous
    }
  })

  test('the switch is config only: a stored or posted two_factor setting changes nothing', async ({
    assert,
  }) => {
    await running.db.table('escalated_settings').insert({
      key: 'two_factor',
      value: '1',
      created_at: sqlTimestamp(),
      updated_at: sqlTimestamp(),
    })
    await as(TEST_USERS.admin).visit('POST', `${ADMIN}/settings`, {
      data: { two_factor: true, twoFactor: true },
      referer: `${ADMIN}/settings`,
    })
    await enrol(TEST_USERS.admin)

    const page = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/tags`)
    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.equal(await statusOf(as(TEST_USERS.admin).visit('GET', CHALLENGE)), 404)
    assert.isFalse(await featureOn(TEST_USERS.admin))
    await running.db.from('escalated_settings').where('key', 'two_factor').delete()
  })

  // ---- The challenge --------------------------------------------------------------

  test('sends an enrolled admin and agent to the challenge, which renders with action', async ({
    assert,
  }) => {
    enforce()
    await enrol(TEST_USERS.admin)
    await enrol(TEST_USERS.agent)

    for (const [user, path] of [
      [TEST_USERS.admin, `${ADMIN}/tags`],
      [TEST_USERS.agent, `${AGENT}/tickets`],
      [TEST_USERS.agent, `${AGENT}/chats`],
    ] as const) {
      const client = as(user)
      const visit = await client.visit('GET', path)
      assert.equal(visit.status, 302, `${path}: ${JSON.stringify(visit.body)}`)
      assert.equal(visit.location, CHALLENGE, path)

      const page = await client.visit('GET', CHALLENGE)
      assert.equal(page.status, 200, JSON.stringify(page.body))
      assert.equal(page.body.component, 'Escalated/Auth/TwoFactorChallenge')
      assert.equal(page.body.props.action, `${running.baseUrl}${CHALLENGE}`)
      assert.equal(page.body.props.error, '')
    }

    assert.isTrue(await featureOn(TEST_USERS.admin))
  })

  test('answers JSON requests with 403 and two_factor_required instead of a redirect', async ({
    assert,
  }) => {
    enforce()
    await enrol(TEST_USERS.admin)

    const visit = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/tags`, {
      headers: { 'Accept': 'application/json', 'X-Inertia': '' },
    })
    assert.equal(visit.status, 403, JSON.stringify(visit.body))
    assert.isTrue(visit.body.two_factor_required)
  })

  test('a valid code passes and returns to the page asked for; the session stays passed', async ({
    assert,
  }) => {
    enforce()
    const secret = await enrol(TEST_USERS.admin)
    const client = as(TEST_USERS.admin)

    await client.visit('GET', `${ADMIN}/tags`)
    const challenge = await client.visit('GET', CHALLENGE)
    const before = challenge.headers.getSetCookie().join(';')

    const verify = await client.visit('POST', CHALLENGE, {
      data: { code: codeFor(secret) },
      referer: CHALLENGE,
    })
    assert.equal(verify.status, 302, JSON.stringify(verify.body))
    assert.equal(verify.location, `${ADMIN}/tags`)
    // The session ID is regenerated.
    assert.notEqual(verify.headers.getSetCookie().join(';'), before)

    const page = await client.visit('GET', `${ADMIN}/tags`)
    assert.equal(page.status, 200, JSON.stringify(page.body))
    const other = await client.visit('GET', `${ADMIN}/settings`)
    assert.equal(other.status, 200, JSON.stringify(other.body))

    // Once passed, the challenge page sends the user on.
    const again = await client.visit('GET', CHALLENGE)
    assert.equal(again.status, 302)
  })

  test('an invalid code returns a code error and lets nobody in', async ({ assert }) => {
    enforce()
    const secret = await enrol(TEST_USERS.admin)
    const client = as(TEST_USERS.admin)

    const wrong = String((Number(codeFor(secret)) + 1) % 1_000_000).padStart(6, '0')
    const verify = await client.visit('POST', CHALLENGE, {
      data: { code: wrong },
      referer: CHALLENGE,
    })
    assert.equal(verify.status, 302)
    assert.equal(verify.location, CHALLENGE)

    const page = await client.visit('GET', CHALLENGE)
    assert.equal(page.body.component, 'Escalated/Auth/TwoFactorChallenge')
    assert.property(page.body.flash.errors ?? {}, 'code', JSON.stringify(page.body.flash))

    const blocked = await client.visit('GET', `${ADMIN}/tags`)
    assert.equal(blocked.location, CHALLENGE)
  })

  test('refuses a code a second time (same time step), and an older step', async ({ assert }) => {
    enforce()
    const secret = await enrol(TEST_USERS.admin)
    const client = as(TEST_USERS.admin)
    const code = codeFor(secret)

    await client.visit('POST', CHALLENGE, { data: { code }, referer: CHALLENGE })
    assert.equal(await statusOf(client.visit('GET', `${ADMIN}/tags`)), 200)

    await signInAgain(client)
    const reused = await client.visit('POST', CHALLENGE, { data: { code }, referer: CHALLENGE })
    assert.equal(reused.location, CHALLENGE, 'the same code is refused')
    const previousStep = await client.visit('POST', CHALLENGE, {
      data: { code: codeFor(secret, -1) },
      referer: CHALLENGE,
    })
    assert.equal(previousStep.location, CHALLENGE, 'an earlier step is refused')
    assert.equal(await locationOf(client.visit('GET', `${ADMIN}/tags`)), CHALLENGE)

    const row = await running.db
      .from('escalated_two_factor')
      .where('user_id', TEST_USERS.admin.id)
      .first()
    assert.isNotNull(row.last_used_step)
  })

  test('a recovery code passes once and is refused the second time', async ({ assert }) => {
    enforce()
    await enrol(TEST_USERS.agent)
    const client = as(TEST_USERS.agent)

    await client.visit('GET', `${AGENT}/tickets`)
    const first = await client.visit('POST', CHALLENGE, {
      data: { recovery_code: RECOVERY_CODES[0].toLowerCase() },
      referer: CHALLENGE,
    })
    assert.equal(first.status, 302, JSON.stringify(first.body))
    assert.equal(first.location, `${AGENT}/tickets`)
    assert.equal(await statusOf(client.visit('GET', `${AGENT}/tickets`)), 200)

    await signInAgain(client)
    const second = await client.visit('POST', CHALLENGE, {
      data: { recovery_code: RECOVERY_CODES[0] },
      referer: CHALLENGE,
    })
    assert.equal(second.location, CHALLENGE)
    const page = await client.visit('GET', CHALLENGE)
    assert.property(page.body.flash.errors ?? {}, 'recovery_code')

    // The other code still works.
    const other = await client.visit('POST', CHALLENGE, {
      data: { recovery_code: RECOVERY_CODES[1] },
      referer: CHALLENGE,
    })
    assert.notEqual(other.location, CHALLENGE)
  })

  test('throttles the verify route to five attempts a minute per user', async ({ assert }) => {
    enforce()
    const secret = await enrol(TEST_USERS.admin)
    const client = as(TEST_USERS.admin)

    for (let attempt = 1; attempt <= 5; attempt++) {
      const visit = await client.visit('POST', CHALLENGE, {
        data: { code: '000000' },
        referer: CHALLENGE,
      })
      assert.equal(visit.status, 302, `attempt ${attempt}`)
    }
    const limited = await client.visit('POST', CHALLENGE, {
      data: { code: codeFor(secret) },
      referer: CHALLENGE,
    })
    assert.equal(limited.status, 429, JSON.stringify(limited.body))
    assert.isTrue(Number(limited.headers.get('retry-after')) > 0)

    // Another user has a counter of their own.
    const agentSecret = await enrol(TEST_USERS.agent)
    await passChallenge(as(TEST_USERS.agent), agentSecret)
  })

  test('challenges every new login, and logging out clears the pass', async ({ assert }) => {
    enforce()
    const secret = await enrol(TEST_USERS.admin)
    const client = as(TEST_USERS.admin)

    await passChallenge(client, secret)
    assert.equal(await statusOf(client.visit('GET', `${ADMIN}/tags`)), 200)

    await signInAgain(client)
    const visit = await client.visit('GET', `${ADMIN}/tags`)
    assert.equal(visit.status, 302)
    assert.equal(visit.location, CHALLENGE)

    await passChallenge(client, await resetAndEnrol(TEST_USERS.admin))
    assert.equal(await statusOf(client.visit('GET', `${ADMIN}/tags`)), 200)
    await client.visit('POST', '/__test/logout', { data: {} })
    assert.equal(await locationOf(client.visit('GET', `${ADMIN}/tags`)), CHALLENGE)
  })

  async function resetAndEnrol(user: TestUser) {
    await running.db.from('escalated_two_factor').where('user_id', user.id).delete()
    return enrol(user)
  }

  test('a pass for one user does not count for another in the same session', async ({ assert }) => {
    enforce()
    const { default: TwoFactorSession } = await import('../../src/support/two_factor_session.js')
    const session = new Map<string, unknown>()
    const fake = {
      get: (key: string) => session.get(key),
      put: (key: string, value: unknown) => session.set(key, value),
      forget: (key: string) => session.delete(key),
    }
    TwoFactorSession.markPassed(fake as any, TEST_USERS.admin)
    assert.isTrue(TwoFactorSession.passed(fake as any, TEST_USERS.admin))
    assert.isFalse(TwoFactorSession.passed(fake as any, TEST_USERS.agent))
  })

  test('does not challenge the token API', async ({ assert }) => {
    enforce()
    await enrol(TEST_USERS.agent)
    const token = await tokenFor(TEST_USERS.agent)
    const list = await new InertiaClient(running.baseUrl).visit('GET', `${API}/tickets`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    assert.equal(list.status, 200, JSON.stringify(list.body))
  })

  test('leaves staff without an enrolment alone while two-factor is not required', async ({
    assert,
  }) => {
    enforce()
    assert.equal(await statusOf(as(TEST_USERS.admin).visit('GET', `${ADMIN}/tags`)), 200)
    assert.equal(await statusOf(as(TEST_USERS.agent).visit('GET', `${AGENT}/tickets`)), 200)
    assert.isFalse(await mustEnrol(TEST_USERS.agent))
  })

  // ---- Enrolment ----------------------------------------------------------------

  test('an agent can enrol: setup, confirm with a code, and the challenge from then on', async ({
    assert,
  }) => {
    enforce()
    const client = as(TEST_USERS.agent)

    const index = await client.visit('GET', ENROL)
    assert.equal(index.status, 200, JSON.stringify(index.body))
    assert.equal(index.body.component, 'Escalated/Admin/Settings/TwoFactor')
    assert.deepEqual(
      { ...index.body.props },
      { enabled: false, pending: false, required: false },
      JSON.stringify(index.body.props)
    )

    const setup = await client.visit('POST', `${ENROL}/setup`, { data: {}, referer: ENROL })
    assert.equal(setup.status, 302, JSON.stringify(setup.body))
    const pending = await client.visit('GET', ENROL)
    assert.isTrue(pending.body.props.pending)
    const flashed = pending.body.flash.two_factor_setup
    assert.match(flashed.qr_uri, /^otpauth:\/\/totp\//)
    assert.lengthOf(flashed.recovery_codes, 8)
    const secret = new URL(flashed.qr_uri).searchParams.get('secret')!

    const confirm = await client.visit('POST', `${ENROL}/confirm`, {
      data: { code: codeFor(secret) },
      referer: ENROL,
    })
    assert.equal(confirm.status, 302, JSON.stringify(confirm.body))
    const enabled = await client.visit('GET', ENROL)
    assert.isTrue(enabled.body.props.enabled, JSON.stringify(enabled.body))
    assert.deepEqual(enabled.body.flash.two_factor_confirmed, {
      recovery_codes: flashed.recovery_codes,
    })

    // Neither the secret nor the codes ever reach a page.
    const body = JSON.stringify(enabled.body.props)
    assert.notInclude(body, secret)

    // The code just confirmed proves the factor for this session...
    assert.equal(await statusOf(client.visit('GET', `${AGENT}/tickets`)), 200)
    // ...and the next login is challenged, where a setup recovery code works.
    await signInAgain(client)
    assert.equal(await locationOf(client.visit('GET', `${AGENT}/tickets`)), CHALLENGE)
    const recovery = await client.visit('POST', CHALLENGE, {
      data: { recovery_code: flashed.recovery_codes[3] },
      referer: CHALLENGE,
    })
    assert.equal(recovery.location, `${AGENT}/tickets`)
  })

  test('refuses a wrong confirmation code, and setup while already enrolled', async ({
    assert,
  }) => {
    enforce()
    const client = as(TEST_USERS.admin)
    await client.visit('POST', `${ENROL}/setup`, { data: {}, referer: ENROL })
    await client.visit('POST', `${ENROL}/confirm`, { data: { code: '12345' }, referer: ENROL })
    const page = await client.visit('GET', ENROL)
    assert.property(page.body.flash.errors ?? {}, 'code')
    assert.isFalse(page.body.props.enabled)

    const secret = await resetAndEnrol(TEST_USERS.admin)
    await passChallenge(client, secret)
    await client.visit('POST', `${ENROL}/setup`, { data: {}, referer: ENROL })
    const rows = await running.db.from('escalated_two_factor').where('user_id', TEST_USERS.admin.id)
    assert.lengthOf(rows, 1)
    assert.isNotNull(rows[0].confirmed_at)
  })

  test('disabling removes the enrolment', async ({ assert }) => {
    enforce()
    const secret = await enrol(TEST_USERS.admin)
    const client = as(TEST_USERS.admin)
    await passChallenge(client, secret)

    const disable = await client.visit('POST', `${ENROL}/disable`, { data: {}, referer: ENROL })
    assert.equal(disable.status, 302, JSON.stringify(disable.body))
    const rows = await running.db.from('escalated_two_factor').where('user_id', TEST_USERS.admin.id)
    assert.lengthOf(rows, 0)
  })

  // ---- Required ------------------------------------------------------------------

  test('when required, staff without an enrolment are sent to enrol and reach nothing else', async ({
    assert,
  }) => {
    enforce()
    requireEnrolment()

    for (const [user, path] of [
      [TEST_USERS.admin, `${ADMIN}/tags`],
      [TEST_USERS.admin, `${ADMIN}/settings`],
      [TEST_USERS.agent, `${AGENT}/tickets`],
    ] as const) {
      const visit = await as(user).visit('GET', path)
      assert.equal(visit.status, 302, `${path}: ${JSON.stringify(visit.body)}`)
      assert.equal(visit.location, ENROL, path)
    }

    const post = await as(TEST_USERS.admin).visit('POST', `${ADMIN}/tags`, {
      data: { name: 'Blocked' },
      referer: `${ADMIN}/tags`,
    })
    assert.equal(post.location, ENROL)

    const page = await as(TEST_USERS.agent).visit('GET', ENROL)
    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.isTrue(page.body.props.required)
    assert.isTrue(await mustEnrol(TEST_USERS.agent))
    assert.isFalse(await mustEnrol(TEST_USERS.customer))

    // Customers are not staff and are never sent to enrol.
    const customer = await as(TEST_USERS.customer).visit('GET', '/support')
    assert.notEqual(customer.location, ENROL)

    // Enrolled staff are no longer told to enrol.
    await enrol(TEST_USERS.agent)
    assert.isFalse(await mustEnrol(TEST_USERS.agent))
  })

  test('the two_factor_required setting wins over config once saved', async ({ assert }) => {
    // Saved from Admin > Settings (switch still off, so nothing blocks the admin).
    const saved = await as(TEST_USERS.admin).visit('POST', `${ADMIN}/settings`, {
      data: { two_factor_required: true },
      referer: `${ADMIN}/settings`,
    })
    assert.equal(saved.status, 302, JSON.stringify(saved.body))
    const settings = await as(TEST_USERS.admin).visit('GET', `${ADMIN}/settings`)
    assert.isTrue(settings.body.props.settings.two_factor_required)

    enforce()
    assert.equal(await locationOf(as(TEST_USERS.agent).visit('GET', `${AGENT}/tickets`)), ENROL)

    // Config says required, the saved setting says not: the setting wins.
    requireEnrolment()
    await running.db
      .from('escalated_settings')
      .where('key', 'two_factor_required')
      .update({ value: '0' })
    assert.equal(await statusOf(as(TEST_USERS.agent).visit('GET', `${AGENT}/tickets`)), 200)
  })

  test('required is ignored while the switch is off', async ({ assert }) => {
    requireEnrolment()
    assert.equal(await statusOf(as(TEST_USERS.agent).visit('GET', `${AGENT}/tickets`)), 200)
    assert.isFalse(await mustEnrol(TEST_USERS.agent))
  })

  // ---- Reset command ----------------------------------------------------------------

  test("clears a user's enrolment from the command line", async ({ assert }) => {
    await enrol(TEST_USERS.agent)
    const ace = await running.app.container.make('ace')
    ace.ui.switchMode('raw')
    await ace.boot()

    const command = await ace.exec('escalated:two-factor:reset', [String(TEST_USERS.agent.id)])
    assert.equal(command.exitCode, 0)
    const rows = await running.db.from('escalated_two_factor').where('user_id', TEST_USERS.agent.id)
    assert.lengthOf(rows, 0)

    const again = await ace.exec('escalated:two-factor:reset', [String(TEST_USERS.agent.id)])
    assert.equal(again.exitCode, 0)
    const nobody = await ace.exec('escalated:two-factor:reset', ['999999'])
    assert.equal(nobody.exitCode, 1)
  })
})
