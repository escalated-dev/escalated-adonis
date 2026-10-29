import { test } from '@japa/runner'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'
import { DateTime } from 'luxon'
import { Secret, TOTP } from 'otpauth'
import { SignJWT, UnsecuredJWT } from 'jose'
import { InertiaClient, sqlTimestamp, testApp, type TestApp, type Visit } from './helpers/app.js'
import User, { TEST_USERS, type TestUser } from './fixtures/user.js'
import { setAccess, setSso } from './helpers/access.js'
import {
  IDP_CERT_BODY,
  IDP_ENTITY_ID,
  assertionXml,
  b64,
  responseXml,
  sign,
} from './helpers/saml.js'
import type { AccessConfig } from '../../src/support/access_features.js'
import type { SsoConfig } from '../../src/support/sso.js'

/*
|--------------------------------------------------------------------------
| Single sign-on behind an install-level switch
|--------------------------------------------------------------------------
|
| ADR 2026-10-29-configurable-access-features. SSO settings were saved and
| SsoService could check a SAML response, but no route signed anyone in.
|
| `access.sso` (ESCALATED_SSO) now decides. Off, the default: the SSO settings
| screen and every sign-in route answer 404. On: `{prefix}/sso/login` signs
| users in through the provider chosen in Admin > Settings > SSO -- SAML
| (signed assertion, Issuer, Audience, Destination, Recipient, windows,
| InResponseTo against stored request IDs, replay), OAuth 2 / OIDC (state +
| PKCE S256, userinfo) or JWT (pinned algorithm, exp, aud, single-use jti).
| Every request here goes through the real router and middleware.
|
*/

const PREFIX = '/support'
const SSO = `${PREFIX}/sso`
const ADMIN = `${PREFIX}/admin`
const SETTINGS = `${ADMIN}/settings/sso`
const CHALLENGE = `${PREFIX}/two-factor/challenge`
const JWT_SECRET = 'a-shared-secret-long-enough-for-hs256!'

const OAUTH = {
  authorize: 'https://idp.example.test/oauth/authorize',
  token: 'https://idp.example.test/oauth/token',
  userinfo: 'https://idp.example.test/oauth/userinfo',
}

const RSA = generateKeyPairSync('rsa', { modulusLength: 2048 })
const RSA_PUBLIC = RSA.publicKey.export({ type: 'spki', format: 'pem' }).toString()

test.group('Single sign-on', (group) => {
  let running: TestApp
  /** Requests the fake OAuth server received. */
  let oauthCalls: Array<{ url: string; body: string; headers: Record<string, string> }> = []
  /** What the fake userinfo endpoint answers. */
  let profile: Record<string, unknown> = {}

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(async () => {
    configure()
    oauthCalls = []
    profile = { sub: 'agent-2', email: 'user2@example.test', name: 'Agent Two' }
    await running.db.from('escalated_settings').whereLike('key', 'sso_%').delete()
    await running.db.from('escalated_sso_message_ids').delete()
    await running.db.from('escalated_role_users').delete()
    await running.db.from('escalated_two_factor').delete()
    await running.db
      .from('escalated_settings')
      .update({ created_at: sqlTimestamp(), updated_at: sqlTimestamp() })
    User.forgetCreated()
    return async () => {
      setAccess(undefined)
      setSso(undefined)
      await running.db.from('escalated_settings').whereLike('key', 'sso_%').delete()
      await running.db.from('escalated_role_users').delete()
      await running.db.from('escalated_two_factor').delete()
      User.forgetCreated()
    }
  })

  group.each.timeout(60_000)

  // ---- Helpers ------------------------------------------------------------------

  /** SSO on (unless `access` says otherwise), with the fake OAuth server wired in. */
  function configure(access: AccessConfig = { sso: true }, sso: SsoConfig = {}) {
    setAccess(access)
    setSso({ baseUrl: running?.baseUrl, fetch: fakeFetch as any, ...sso })
  }

  async function fakeFetch(input: any, init: any = {}) {
    const url = String(input instanceof URL ? input.href : (input?.url ?? input))
    const headers: Record<string, string> = {}
    new Headers(init.headers).forEach((value, key) => (headers[key] = value))
    const body = init.body === undefined ? '' : String(init.body)
    oauthCalls.push({ url, body, headers })
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    if (url.startsWith(OAUTH.token)) {
      return json({ access_token: 'access-123', token_type: 'Bearer', expires_in: 3600 })
    }
    if (url.startsWith(OAUTH.userinfo)) {
      if (headers.authorization !== 'Bearer access-123') return json({ error: 'nope' }, 401)
      return json(profile)
    }
    return json({ error: 'unexpected' }, 404)
  }

  async function settings(values: Record<string, string>) {
    const { default: SsoService } = await import('../../src/services/sso_service.js')
    await new SsoService().saveConfig(values as any)
  }

  function guest() {
    return new InertiaClient(running.baseUrl)
  }

  function as(user: TestUser) {
    return new InertiaClient(running.baseUrl, { user })
  }

  async function shared(user: TestUser) {
    const { escalatedSharedData } = await import('../../src/support/shared_data.js')
    return escalatedSharedData({ auth: { user } })
  }

  async function ssoFeature(): Promise<boolean> {
    const data = await shared(TEST_USERS.admin)
    return data.features.sso
  }

  async function storedProvider(): Promise<string> {
    const { default: SsoService } = await import('../../src/services/sso_service.js')
    const config = await new SsoService().getConfig()
    return config.sso_provider
  }

  async function startState(client: InertiaClient) {
    const authorize = await startOauth(client)
    return authorize.searchParams.get('state')
  }

  async function statusOf(visit: Promise<Visit>) {
    const result = await visit
    return result.status
  }

  /** Signed in: the session reaches the agent area (the gate lets agents in). */
  async function signedInAs(client: InertiaClient) {
    const visit = await client.visit('GET', `${PREFIX}/agent/tickets`)
    return visit.status
  }

  const acsUrl = () => `${running.baseUrl}${SSO}/saml/acs`
  const metadataUrl = () => `${running.baseUrl}${SSO}/saml/metadata`

  async function samlProvider(overrides: Record<string, string> = {}) {
    await settings({
      sso_provider: 'saml',
      sso_entity_id: IDP_ENTITY_ID,
      sso_login_url: 'https://idp.example.test/sso',
      sso_certificate: IDP_CERT_BODY,
      ...overrides,
    })
  }

  /** Starts SAML sign-in and returns the AuthnRequest ID the IdP was sent. */
  async function startSaml(client: InertiaClient) {
    const visit = await client.visit('GET', `${SSO}/login`)
    if (visit.status !== 302)
      throw new Error(`login: ${visit.status} ${JSON.stringify(visit.body)}`)
    const location = new URL(visit.location!)
    const xml = inflateRawSync(
      Buffer.from(location.searchParams.get('SAMLRequest')!, 'base64')
    ).toString('utf-8')
    return { location, xml, requestId: /\sID="([^"]+)"/.exec(xml)![1] }
  }

  type SamlOptions = Parameters<typeof assertionXml>[0] & {
    destination?: string | null
    key?: string
    signed?: 'Assertion' | 'Response' | 'none'
  }

  function samlResponse(requestId: string | null, options: SamlOptions = {}) {
    const { destination, key, signed = 'Assertion', ...assertion } = options
    const xml = responseXml(
      assertionXml({
        email: 'user2@example.test',
        audiences: [metadataUrl()],
        recipient: acsUrl(),
        inResponseTo: requestId,
        ...assertion,
      }),
      { destination: destination === undefined ? acsUrl() : destination, inResponseTo: requestId }
    )
    return signed === 'none' ? xml : sign(xml, signed, key)
  }

  function postAcs(client: InertiaClient, xml: string) {
    return client.visit('POST', `${SSO}/saml/acs`, { form: { SAMLResponse: b64(xml) } })
  }

  async function oauthProvider() {
    await settings({
      sso_provider: 'oauth',
      sso_oauth_authorize_url: OAUTH.authorize,
      sso_oauth_token_url: OAUTH.token,
      sso_oauth_userinfo_url: OAUTH.userinfo,
      sso_oauth_client_id: 'escalated-client',
      sso_oauth_client_secret: 'client-secret',
    })
  }

  async function startOauth(client: InertiaClient) {
    const visit = await client.visit('GET', `${SSO}/login`)
    if (visit.status !== 302)
      throw new Error(`login: ${visit.status} ${JSON.stringify(visit.body)}`)
    return new URL(visit.location!)
  }

  async function jwtProvider(overrides: Record<string, string> = {}) {
    await settings({
      sso_provider: 'jwt',
      sso_url: 'https://idp.example.test/jwt',
      sso_jwt_secret: JWT_SECRET,
      sso_jwt_algorithm: 'HS256',
      ...overrides,
    })
  }

  let jtiSequence = 0

  async function jwt(
    claims: Record<string, unknown> = {},
    options: { alg?: string; key?: any; omit?: string[] } = {}
  ) {
    const payload: Record<string, unknown> = {
      email: 'user2@example.test',
      name: 'Agent Two',
      aud: running.baseUrl,
      exp: Math.floor(Date.now() / 1000) + 300,
      jti: `jti-${++jtiSequence}-${Date.now()}`,
      ...claims,
    }
    for (const claim of options.omit ?? []) delete payload[claim]
    const alg = options.alg ?? 'HS256'
    return new SignJWT(payload as any)
      .setProtectedHeader({ alg })
      .sign(options.key ?? new TextEncoder().encode(JWT_SECRET))
  }

  function jwtCallback(client: InertiaClient, token: string, method: 'GET' | 'POST' = 'GET') {
    return method === 'GET'
      ? client.visit('GET', `${SSO}/jwt/callback?jwt=${encodeURIComponent(token)}`)
      : client.visit('POST', `${SSO}/jwt/callback`, { form: { jwt: token } })
  }

  async function enrol(user: TestUser) {
    const { default: TwoFactor } = await import('../../src/models/two_factor.js')
    const secret = new Secret({ size: 20 }).base32
    await TwoFactor.create({
      userId: user.id,
      secret,
      recoveryCodes: [],
      confirmedAt: DateTime.now(),
    } as any)
    return secret
  }

  async function roleSlugsOf(userId: number) {
    const rows = await running.db
      .from('escalated_role_users as ru')
      .join('escalated_roles as r', 'r.id', 'ru.role_id')
      .where('ru.user_id', userId)
      .select('r.slug')
    return rows.map((row: any) => row.slug).sort()
  }

  async function giveRole(user: TestUser, slug: string) {
    const role = await running.db.from('escalated_roles').where('slug', slug).first()
    await running.db.table('escalated_role_users').insert({ role_id: role.id, user_id: user.id })
  }

  async function seedRoles() {
    const { seedPermissionsAndRoles } = await import('../../src/support/permission_catalog.js')
    await seedPermissionsAndRoles()
  }

  // ---- Switch ---------------------------------------------------------------------

  test('is off by default: every SSO route and the settings screen answer 404', async ({
    assert,
  }) => {
    setAccess(undefined)
    await jwtProvider()
    for (const [method, path] of [
      ['GET', `${SSO}/login`],
      ['GET', `${SSO}/saml/metadata`],
      ['POST', `${SSO}/saml/acs`],
      ['GET', `${SSO}/oauth/callback?code=x&state=y`],
      ['GET', `${SSO}/jwt/callback?jwt=x`],
      ['POST', `${SSO}/jwt/callback`],
    ]) {
      const options = method === 'POST' ? { form: {} } : {}
      assert.equal(await statusOf(guest().visit(method, path, options)), 404, path)
    }
    assert.equal(await statusOf(as(TEST_USERS.admin).visit('GET', SETTINGS)), 404)
    assert.equal(
      await statusOf(
        as(TEST_USERS.admin).visit('POST', SETTINGS, { data: { sso_provider: 'none' } })
      ),
      404
    )
    const data = await shared(TEST_USERS.admin)
    assert.isFalse(data.features.sso)

    // A valid token signs nobody in while the switch is off.
    const client = guest()
    assert.equal(await statusOf(jwtCallback(client, await jwt())), 404)
    assert.equal(await signedInAs(client), 401)
  })

  test('is config only: a stored "sso" setting does not switch it on', async ({ assert }) => {
    setAccess(undefined)
    for (const key of ['sso', 'access.sso']) {
      await running.db.table('escalated_settings').insert({
        key,
        value: 'true',
        created_at: sqlTimestamp(),
        updated_at: sqlTimestamp(),
      })
    }
    try {
      assert.isFalse(await ssoFeature())
      assert.equal(await statusOf(guest().visit('GET', `${SSO}/login`)), 404)
    } finally {
      await running.db.from('escalated_settings').whereIn('key', ['sso', 'access.sso']).delete()
    }
  })

  test('the ESCALATED_SSO environment variable switches it on when config leaves it unset', async ({
    assert,
  }) => {
    setAccess({})
    process.env.ESCALATED_SSO = 'true'
    try {
      assert.isTrue(await ssoFeature())
    } finally {
      delete process.env.ESCALATED_SSO
    }
    assert.isFalse(await ssoFeature())
  })

  test('on: features.sso is true and provider "none" makes sso/login answer 404', async ({
    assert,
  }) => {
    assert.isTrue(await ssoFeature())
    assert.equal(await statusOf(guest().visit('GET', `${SSO}/login`)), 404)
    await settings({ sso_provider: 'none' })
    assert.equal(await statusOf(guest().visit('GET', `${SSO}/login`)), 404)
    // Another provider's routes answer 404 too.
    await jwtProvider()
    assert.equal(await statusOf(guest().visit('GET', `${SSO}/saml/metadata`)), 404)
    assert.equal(await statusOf(guest().visit('GET', `${SSO}/oauth/callback`)), 404)
  })

  // ---- Settings screen ------------------------------------------------------------

  test('the settings page renders SsoSettings with masked secrets and the endpoints', async ({
    assert,
  }) => {
    await settings({
      sso_provider: 'jwt',
      sso_url: 'https://idp.example.test/jwt',
      sso_jwt_secret: JWT_SECRET,
      sso_oauth_client_secret: 'client-secret',
    })
    const page = await as(TEST_USERS.admin).visit('GET', SETTINGS)
    assert.equal(page.status, 200, JSON.stringify(page.body))
    assert.equal(page.body.component, 'Escalated/Admin/Settings/SsoSettings')
    assert.equal(page.body.props.settings.sso_jwt_secret, '********')
    assert.equal(page.body.props.settings.sso_oauth_client_secret, '********')
    assert.notInclude(JSON.stringify(page.body), JWT_SECRET)
    assert.notInclude(JSON.stringify(page.body), 'client-secret')
    assert.deepEqual(page.body.props.endpoints, {
      login: `${running.baseUrl}${SSO}/login`,
      sp_entity_id: metadataUrl(),
      metadata: metadataUrl(),
      acs: acsUrl(),
      oauth_redirect: `${running.baseUrl}${SSO}/oauth/callback`,
      jwt_callback: `${running.baseUrl}${SSO}/jwt/callback`,
    })

    // Agents do not reach it: it is an admin screen.
    assert.equal(await statusOf(as(TEST_USERS.agent).visit('GET', SETTINGS)), 403)
  })

  test('saving keeps a masked secret, validates per provider, and stores the rest', async ({
    assert,
  }) => {
    const { default: SsoService } = await import('../../src/services/sso_service.js')
    await jwtProvider()
    const admin = as(TEST_USERS.admin)

    const saved = await admin.visit('POST', SETTINGS, {
      data: {
        sso_provider: 'jwt',
        sso_url: 'https://idp.example.test/jwt2',
        sso_jwt_secret: '********',
        sso_jwt_algorithm: 'HS512',
      },
      referer: SETTINGS,
    })
    assert.equal(saved.status, 302)
    const config = await new SsoService().getConfig()
    assert.equal(config.sso_jwt_secret, JWT_SECRET)
    assert.equal(config.sso_url, 'https://idp.example.test/jwt2')
    assert.equal(config.sso_jwt_algorithm, 'HS512')

    const invalid = await admin.visit('POST', SETTINGS, {
      data: { sso_provider: 'oauth', sso_oauth_authorize_url: 'not a url' },
      referer: SETTINGS,
    })
    assert.equal(invalid.status, 302)
    const back = await admin.visit('GET', SETTINGS)
    assert.properties(back.body.flash.errors, [
      'sso_oauth_authorize_url',
      'sso_oauth_token_url',
      'sso_oauth_client_id',
    ])
    assert.equal(await storedProvider(), 'jwt')

    const badProvider = await admin.visit('POST', SETTINGS, {
      data: { sso_provider: 'kerberos' },
      referer: SETTINGS,
    })
    assert.equal(badProvider.status, 302)
    assert.equal(await storedProvider(), 'jwt')
  })

  test('the settings screen cannot change the install-level SSO rules', async ({ assert }) => {
    await jwtProvider()
    await as(TEST_USERS.admin).visit('POST', SETTINGS, {
      data: {
        sso_provider: 'jwt',
        sso_url: 'https://idp.example.test/jwt',
        sso_jwt_secret: JWT_SECRET,
        sso_allow_idp_initiated: '1',
        sso_create_users: '1',
        sso: 'true',
      },
      referer: SETTINGS,
    })
    const stored = await running.db
      .from('escalated_settings')
      .whereIn('key', ['sso_allow_idp_initiated', 'sso_create_users', 'sso'])
    assert.lengthOf(stored, 0)
  })

  // ---- SAML -----------------------------------------------------------------------

  test('SAML: metadata names our entity ID and ACS, and login sends an AuthnRequest', async ({
    assert,
  }) => {
    await samlProvider()
    const metadata = await guest().visit('GET', `${SSO}/saml/metadata`)
    assert.equal(metadata.status, 200)
    assert.include(metadata.headers.get('content-type') ?? '', 'samlmetadata+xml')
    assert.include(metadata.body, `entityID="${metadataUrl()}"`)
    assert.include(metadata.body, `Location="${acsUrl()}"`)
    assert.include(metadata.body, 'WantAssertionsSigned="true"')

    const { location, xml, requestId } = await startSaml(guest())
    assert.equal(location.origin + location.pathname, 'https://idp.example.test/sso')
    assert.include(xml, `AssertionConsumerServiceURL="${acsUrl()}"`)
    assert.include(xml, `<saml:Issuer>${metadataUrl()}</saml:Issuer>`)
    const stored = await running.db
      .from('escalated_sso_message_ids')
      .where('kind', 'request')
      .where('message_id', requestId)
      .first()
    assert.exists(stored)
  })

  test('SAML: a signed response to our AuthnRequest signs the matched user in', async ({
    assert,
  }) => {
    await samlProvider()
    const client = guest()
    assert.equal(await signedInAs(client), 401)
    const { requestId } = await startSaml(client)

    // The IdP posts cross-site, so the browser does not send the session cookie.
    const acs = await postAcs(guest(), samlResponse(requestId, { email: 'USER2@Example.test' }))
    assert.equal(acs.status, 302, JSON.stringify(acs.body))
    assert.equal(acs.location, `${PREFIX}/agent/tickets`)

    // The ACS answer carries the signed-in session; the same browser is in.
    const browser = guest()
    const second = await startSaml(browser)
    const signedIn = await postAcs(browser, samlResponse(second.requestId))
    assert.equal(signedIn.status, 302)
    assert.equal(await signedInAs(browser), 200)
  })

  test('SAML: refuses responses that fail any check, and signs nobody in', async ({ assert }) => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const otherKey = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    await samlProvider()
    const past = new Date(Date.now() - 60 * 60_000).toISOString()

    const cases: Array<[string, (requestId: string) => string]> = [
      ['unsigned assertion', (id) => samlResponse(id, { signed: 'none' })],
      ['only the Response signed', (id) => samlResponse(id, { signed: 'Response' })],
      ['signed by another key', (id) => samlResponse(id, { key: otherKey })],
      [
        'tampered after signing',
        (id) => samlResponse(id).replaceAll('user2@example.test', 'user1@example.test'),
      ],
      ['wrong Issuer', (id) => samlResponse(id, { issuer: 'https://evil.example.test' })],
      ['wrong Audience', (id) => samlResponse(id, { audiences: ['https://other-sp.test'] })],
      ['wrong Destination', (id) => samlResponse(id, { destination: 'https://other-sp.test/acs' })],
      ['wrong Recipient', (id) => samlResponse(id, { recipient: 'https://other-sp.test/acs' })],
      ['expired', (id) => samlResponse(id, { notOnOrAfter: past, confirmationNotOnOrAfter: past })],
      ['unknown InResponseTo', () => samlResponse('_never-issued')],
      ['missing InResponseTo (IdP-initiated off)', () => samlResponse(null)],
    ]

    for (const [label, build] of cases) {
      const client = guest()
      const { requestId } = await startSaml(client)
      const visit = await postAcs(client, build(requestId))
      assert.equal(visit.status, 403, label)
      assert.equal(visit.body, 'Single sign-on failed. Contact your administrator.', label)
      assert.equal(await signedInAs(client), 401, label)
    }
  })

  test('SAML: refuses everything while no IdP certificate is configured', async ({ assert }) => {
    await samlProvider()
    const client = guest()
    const { requestId } = await startSaml(client)
    await settings({ sso_certificate: '' })
    assert.equal(await statusOf(postAcs(client, samlResponse(requestId))), 403)
    assert.equal(await statusOf(client.visit('GET', `${SSO}/login`)), 403)
    assert.equal(await signedInAs(client), 401)
  })

  test('SAML: the same assertion is refused the second time', async ({ assert }) => {
    await samlProvider()
    const client = guest()
    const { requestId } = await startSaml(client)
    const message = samlResponse(requestId)
    assert.equal(await statusOf(postAcs(client, message)), 302)
    const replay = guest()
    assert.equal(await statusOf(postAcs(replay, message)), 403)
    assert.equal(await signedInAs(replay), 401)
  })

  test('SAML: IdP-initiated responses only with sso.allowIdpInitiated', async ({ assert }) => {
    await samlProvider()
    assert.equal(await statusOf(postAcs(guest(), samlResponse(null))), 403)
    configure({ sso: true }, { allowIdpInitiated: true })
    assert.equal(await statusOf(postAcs(guest(), samlResponse(null))), 302)
  })

  // ---- OAuth ----------------------------------------------------------------------

  test('OAuth: state and PKCE S256 on the way out; a matching callback signs the user in', async ({
    assert,
  }) => {
    await oauthProvider()
    const client = guest()
    const authorize = await startOauth(client)
    assert.equal(authorize.origin + authorize.pathname, OAUTH.authorize)
    const params = authorize.searchParams
    assert.equal(params.get('response_type'), 'code')
    assert.equal(params.get('client_id'), 'escalated-client')
    assert.equal(params.get('redirect_uri'), `${running.baseUrl}${SSO}/oauth/callback`)
    assert.equal(params.get('code_challenge_method'), 'S256')
    assert.isAbove(params.get('state')!.length, 20)

    const callback = await client.visit(
      'GET',
      `${SSO}/oauth/callback?code=the-code&state=${params.get('state')}`
    )
    assert.equal(callback.status, 302, JSON.stringify(callback.body))
    assert.equal(callback.location, `${PREFIX}/agent/tickets`)
    assert.equal(await signedInAs(client), 200)

    // The code was exchanged server to server with the PKCE verifier.
    const tokenCall = oauthCalls.find((call) => call.url.startsWith(OAUTH.token))!
    const form = new URLSearchParams(tokenCall.body)
    assert.equal(form.get('grant_type'), 'authorization_code')
    assert.equal(form.get('code'), 'the-code')
    const verifier = form.get('code_verifier')!
    assert.isAbove(verifier.length, 42)
    assert.equal(
      createHash('sha256').update(verifier).digest('base64url'),
      params.get('code_challenge')
    )
    assert.exists(oauthCalls.find((call) => call.url.startsWith(OAUTH.userinfo)))
  })

  test('OAuth: a missing or mismatched state, or an IdP error, is refused', async ({ assert }) => {
    await oauthProvider()

    const missing = guest()
    await startOauth(missing)
    assert.equal(await statusOf(missing.visit('GET', `${SSO}/oauth/callback?code=c`)), 403)
    assert.equal(await signedInAs(missing), 401)

    const mismatched = guest()
    await startOauth(mismatched)
    assert.equal(
      await statusOf(mismatched.visit('GET', `${SSO}/oauth/callback?code=c&state=forged`)),
      403
    )
    assert.equal(await signedInAs(mismatched), 401)

    // No sign-in started in this browser: there is no state to match.
    const fresh = guest()
    assert.equal(await statusOf(fresh.visit('GET', `${SSO}/oauth/callback?code=c&state=x`)), 403)

    const refused = guest()
    const authorize = await startOauth(refused)
    assert.equal(
      await statusOf(
        refused.visit(
          'GET',
          `${SSO}/oauth/callback?error=access_denied&state=${authorize.searchParams.get('state')}`
        )
      ),
      403
    )
    assert.isUndefined(oauthCalls.find((call) => call.url.startsWith(OAUTH.token)))
  })

  test('OAuth: the state is single use', async ({ assert }) => {
    await oauthProvider()
    const client = guest()
    const state = await startState(client)
    assert.equal(
      await statusOf(client.visit('GET', `${SSO}/oauth/callback?code=c&state=${state}`)),
      302
    )
    assert.equal(
      await statusOf(client.visit('GET', `${SSO}/oauth/callback?code=c&state=${state}`)),
      403
    )
  })

  test('OAuth: a profile whose email is not verified is refused', async ({ assert }) => {
    await oauthProvider()
    profile = { ...profile, email_verified: false }
    const client = guest()
    const state = await startState(client)
    assert.equal(
      await statusOf(client.visit('GET', `${SSO}/oauth/callback?code=c&state=${state}`)),
      403
    )
  })

  // ---- JWT ------------------------------------------------------------------------

  test('JWT: login hands off to the IdP and a valid token signs the user in', async ({
    assert,
  }) => {
    await jwtProvider()
    const login = await guest().visit('GET', `${SSO}/login`)
    assert.equal(login.status, 302)
    const target = new URL(login.location!)
    assert.equal(target.origin + target.pathname, 'https://idp.example.test/jwt')
    assert.equal(target.searchParams.get('return_to'), `${running.baseUrl}${SSO}/jwt/callback`)

    const client = guest()
    const visit = await jwtCallback(client, await jwt())
    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(await signedInAs(client), 200)

    const posted = guest()
    assert.equal(await statusOf(jwtCallback(posted, await jwt(), 'POST')), 302)
    assert.equal(await signedInAs(posted), 200)
  })

  test('JWT: refuses bad signatures, alg none, other algorithms, exp, aud and jti problems', async ({
    assert,
  }) => {
    await jwtProvider()
    const now = Math.floor(Date.now() / 1000)
    const unsecured = new UnsecuredJWT({
      email: 'user2@example.test',
      aud: running.baseUrl,
      exp: now + 300,
      jti: 'none-1',
    }).encode()

    const cases: Array<[string, () => Promise<string> | string]> = [
      [
        'bad signature',
        () => jwt({}, { key: new TextEncoder().encode('another-secret-entirely!!') }),
      ],
      ['alg none', () => unsecured],
      [
        'another HMAC algorithm',
        () => jwt({}, { alg: 'HS512', key: new TextEncoder().encode(JWT_SECRET) }),
      ],
      ['missing exp', () => jwt({}, { omit: ['exp'] })],
      ['past exp', () => jwt({ exp: now - 3600 })],
      ['wrong aud', () => jwt({ aud: 'https://other-app.example.test' })],
      ['missing aud', () => jwt({}, { omit: ['aud'] })],
      ['missing jti', () => jwt({}, { omit: ['jti'] })],
      ['not yet valid', () => jwt({ nbf: now + 3600 })],
      ['no email', () => jwt({ email: 'not-an-email' })],
    ]
    for (const [label, build] of cases) {
      const client = guest()
      const visit = await jwtCallback(client, await build())
      assert.equal(visit.status, 403, label)
      assert.equal(await signedInAs(client), 401, label)
    }
  })

  test('JWT: RS256 with the configured public key; an HS256 token keyed with it is refused', async ({
    assert,
  }) => {
    await jwtProvider({ sso_jwt_algorithm: 'RS256', sso_jwt_secret: RSA_PUBLIC })
    const client = guest()
    assert.equal(
      await statusOf(jwtCallback(client, await jwt({}, { alg: 'RS256', key: RSA.privateKey }))),
      302
    )
    // Algorithm switching: HS256 with the public key as the HMAC secret.
    const forged = await jwt({}, { alg: 'HS256', key: new TextEncoder().encode(RSA_PUBLIC) })
    assert.equal(await statusOf(jwtCallback(guest(), forged)), 403)
  })

  test('JWT: a jti works once', async ({ assert }) => {
    await jwtProvider()
    const token = await jwt({ jti: 'only-once' })
    assert.equal(await statusOf(jwtCallback(guest(), token)), 302)
    const again = guest()
    assert.equal(await statusOf(jwtCallback(again, token)), 403)
    assert.equal(await signedInAs(again), 401)
    const fresh = await jwt({ jti: 'only-once' })
    assert.equal(await statusOf(jwtCallback(guest(), fresh)), 403)
  })

  // ---- Users and roles ------------------------------------------------------------

  test('an unknown email is refused unless sso.createUsers is on', async ({ assert }) => {
    await jwtProvider()
    const client = guest()
    const token = await jwt({ email: 'newcomer@example.test', name: 'New Comer' })
    assert.equal(await statusOf(jwtCallback(client, token)), 403)
    assert.isNull(await User.query().whereRaw('', ['newcomer@example.test']).first())

    configure({ sso: true }, { createUsers: true })
    const created = guest()
    const visit = await jwtCallback(
      created,
      await jwt({ email: 'newcomer@example.test', name: 'New Comer' })
    )
    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    // Not staff: SSO grants no gate, so they land on the customer portal.
    assert.equal(visit.location, PREFIX)
    const user = await User.query().whereRaw('', ['newcomer@example.test']).first()
    assert.exists(user)
    assert.equal(user!.name, 'New Comer')
    assert.equal(user!.role, 'customer')
    assert.isAbove(user!.password!.length, 30)
    assert.equal(await signedInAs(created), 403)
  })

  test('role mapping assigns the named role only with roles on and sso.syncRoles on', async ({
    assert,
  }) => {
    await seedRoles()
    await jwtProvider()
    const agent = TEST_USERS.agent
    await giveRole(agent, 'agent')
    const signIn = async () => statusOf(jwtCallback(guest(), await jwt({ role: 'light_agent' })))

    // Roles off, sync on: nothing changes.
    configure({ sso: true }, { syncRoles: true })
    assert.equal(await signIn(), 302)
    assert.deepEqual(await roleSlugsOf(agent.id), ['agent'])

    // Roles on, sync off: nothing changes.
    configure({ sso: true, rolesPermissions: true }, { syncRoles: false })
    assert.equal(await signIn(), 302)
    assert.deepEqual(await roleSlugsOf(agent.id), ['agent'])

    // Both on: the asserted role replaces the user's roles.
    configure({ sso: true, rolesPermissions: true }, { syncRoles: true })
    assert.equal(await signIn(), 302)
    assert.deepEqual(await roleSlugsOf(agent.id), ['light_agent'])

    // An unknown role changes nothing.
    assert.equal(await statusOf(jwtCallback(guest(), await jwt({ role: 'wizard' }))), 302)
    assert.deepEqual(await roleSlugsOf(agent.id), ['light_agent'])
  })

  // ---- Two-factor -----------------------------------------------------------------

  test('signing in through SSO does not skip the two-factor challenge', async ({ assert }) => {
    configure({ sso: true, twoFactor: true })
    await jwtProvider()
    const secret = await enrol(TEST_USERS.agent)
    const client = guest()

    assert.equal(await statusOf(jwtCallback(client, await jwt())), 302)
    const first = await client.visit('GET', `${PREFIX}/agent/tickets`)
    assert.equal(first.status, 302)
    assert.equal(first.location, CHALLENGE)

    const code = new TOTP({ secret: Secret.fromBase32(secret) }).generate()
    const passed = await client.visit('POST', CHALLENGE, { data: { code }, referer: CHALLENGE })
    assert.equal(passed.status, 302)
    assert.notEqual(passed.location, CHALLENGE)
    assert.equal(await signedInAs(client), 200)

    // A new SSO sign-in in the same browser is challenged again.
    assert.equal(await statusOf(jwtCallback(client, await jwt())), 302)
    const again = await client.visit('GET', `${PREFIX}/agent/tickets`)
    assert.equal(again.location, CHALLENGE)
  })

  test('an intended local path is where sign-in lands; other sites are ignored', async ({
    assert,
  }) => {
    await jwtProvider()
    const client = guest()
    await client.visit('GET', `${SSO}/login?intended=${encodeURIComponent(`${ADMIN}/reports`)}`)
    const visit = await jwtCallback(client, await jwt())
    assert.equal(visit.location, `${ADMIN}/reports`)

    const other = guest()
    await other.visit('GET', `${SSO}/login?intended=${encodeURIComponent('//evil.example.test/')}`)
    const landed = await jwtCallback(other, await jwt())
    assert.equal(landed.location, `${PREFIX}/agent/tickets`)
  })
})
