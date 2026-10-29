import { test } from '@japa/runner'
import { testApp, type TestApp } from './helpers/app.js'
import { setSso } from './helpers/access.js'
import type { SsoConfig } from '../../src/support/sso.js'
import {
  ACS_URL,
  IDP_CERT_BODY,
  IDP_ENTITY_ID,
  SP_ENTITY_ID,
  assertionXml,
  b64,
  rejects,
  responseXml,
  sign,
  type AssertionOptions,
  type ResponseOptions,
} from './helpers/saml.js'

/*
|--------------------------------------------------------------------------
| A signed SAML assertion must be meant for us, now, once
|--------------------------------------------------------------------------
|
| Signature checking (saml_signature.spec.ts) proves the IdP wrote the
| assertion. It does not prove the assertion was written for this service
| provider, for this login, or that it has not been used already. Without
| those checks a valid assertion issued to another SP that trusts the same
| IdP, or one captured from an earlier login, signs its subject in here.
|
| SsoService.validateSamlAssertion now also requires: our SP entity ID in
| every AudienceRestriction; our ACS URL as the Response Destination and the
| bearer SubjectConfirmationData Recipient; Conditions and confirmation
| NotBefore / NotOnOrAfter inside the window (configurable clock skew); an
| InResponseTo naming a request we issued and have not used (IdP-initiated
| only when `sso.allowIdpInitiated` is on in config); and an assertion ID not seen
| before within its validity window.
|
*/

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString()

test.group('SAML assertion binding', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  /** `options` are the install-level `sso` config; `settings` the stored `sso_*` keys. */
  async function configure(options: SsoConfig = {}, settings: Record<string, string> = {}) {
    const { default: SsoService } = await import('../../src/services/sso_service.js')
    const service = new SsoService()
    setSso({ spEntityId: SP_ENTITY_ID, acsUrl: ACS_URL, clockSkew: 120, ...options })
    await service.saveConfig({
      sso_provider: 'saml',
      sso_entity_id: IDP_ENTITY_ID,
      sso_certificate: IDP_CERT_BODY,
      ...settings,
    } as any)
    return service
  }

  /** A signed response answering `requestId` (or unsolicited when null). */
  function response(
    requestId: string | null,
    assertion: AssertionOptions = {},
    outer: ResponseOptions = {},
    signed: 'Assertion' | 'Response' = 'Assertion'
  ) {
    const xml = responseXml(assertionXml({ inResponseTo: requestId, ...assertion }), {
      inResponseTo: requestId,
      ...outer,
    })
    return b64(sign(xml, signed))
  }

  test('accepts a response to a request we issued', async ({ assert }) => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()

    assert.match(requestId, /^_[0-9a-f]{40}$/)
    const user = await service.validateSamlAssertion(response(requestId))
    assert.equal(user.email, 'alice@example.test')
  })

  test('refuses a signed Response whose assertion is unsigned', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, {}, {}, 'Response')),
      /assertion is not signed/
    )
  })

  // ----- Audience -----------------------------------------------------

  test('rejects an assertion with no AudienceRestriction', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, { audiences: null })),
      /Audience/
    )
  })

  test('rejects an assertion issued for another service provider', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(
        response(requestId, { audiences: ['https://other-sp.example.test/metadata'] })
      ),
      /Audience/
    )
  })

  test('accepts an AudienceRestriction that lists us among others', async ({ assert }) => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    const user = await service.validateSamlAssertion(
      response(requestId, { audiences: ['https://other-sp.example.test/metadata', SP_ENTITY_ID] })
    )
    assert.equal(user.email, 'alice@example.test')
  })

  // ----- Destination / Recipient --------------------------------------

  test('rejects a response whose Destination is not our ACS URL', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(
        response(requestId, {}, { destination: 'https://other-sp.example.test/acs' })
      ),
      /Destination/
    )
  })

  test('rejects a bearer confirmation whose Recipient is not our ACS URL', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(
        response(requestId, { recipient: 'https://other-sp.example.test/acs' })
      ),
      /Recipient/
    )
  })

  test('rejects a bearer confirmation without a Recipient', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, { recipient: null })),
      /Recipient/
    )
  })

  test('rejects an assertion without a bearer SubjectConfirmation', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, { confirmationMethod: null })),
      /SubjectConfirmation/
    )
    await rejects(
      service.validateSamlAssertion(
        response(requestId, {
          confirmationMethod: 'urn:oasis:names:tc:SAML:2.0:cm:holder-of-key',
        })
      ),
      /SubjectConfirmation/
    )
  })

  // ----- Validity window ----------------------------------------------

  test('rejects Conditions that are not yet valid', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, { notBefore: ahead(10 * 60_000) })),
      /not yet valid/
    )
  })

  test('rejects Conditions that have expired', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, { notOnOrAfter: ago(10 * 60_000) })),
      /expired/
    )
  })

  test('rejects a subject confirmation that has expired', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(
        response(requestId, { confirmationNotOnOrAfter: ago(10 * 60_000) })
      ),
      /subject confirmation has expired/
    )
  })

  test('rejects a subject confirmation without NotOnOrAfter', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, { confirmationNotOnOrAfter: null })),
      /NotOnOrAfter/
    )
  })

  test('rejects a subject confirmation that is not yet valid', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(
        response(requestId, { confirmationNotBefore: ahead(10 * 60_000) })
      ),
      /subject confirmation is not yet valid/
    )
  })

  test('applies the configured clock skew', async ({ assert }) => {
    const lenient = await configure({ clockSkew: 120 })
    const first = await lenient.createSamlRequestId()
    const user = await lenient.validateSamlAssertion(
      response(first, { notOnOrAfter: ago(30_000), confirmationNotOnOrAfter: ago(30_000) })
    )
    assert.equal(user.email, 'alice@example.test')

    const strict = await configure({ clockSkew: 0 })
    const second = await strict.createSamlRequestId()
    await rejects(
      strict.validateSamlAssertion(response(second, { notOnOrAfter: ago(30_000) })),
      /expired/
    )
  })

  test('caps the clock skew at five minutes', async () => {
    const service = await configure({ clockSkew: 86400 })
    const requestId = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, { notOnOrAfter: ago(10 * 60_000) })),
      /expired/
    )
  })

  // ----- InResponseTo -------------------------------------------------

  test('rejects an InResponseTo we never issued', async () => {
    const service = await configure()
    await rejects(service.validateSamlAssertion(response('_never-issued')), /InResponseTo/)
  })

  test('rejects a second response to the same request', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await service.validateSamlAssertion(response(requestId))
    await rejects(service.validateSamlAssertion(response(requestId)), /InResponseTo/)
  })

  test('rejects a response to a request that has expired', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    await running.db
      .from('escalated_sso_message_ids')
      .where('kind', 'request')
      .where('message_id', requestId)
      .update({ expires_at: Math.floor(Date.now() / 1000) - 1 })
    await rejects(service.validateSamlAssertion(response(requestId)), /InResponseTo/)
  })

  test('rejects a response to another request than the one the host expects', async ({
    assert,
  }) => {
    const service = await configure()
    const mine = await service.createSamlRequestId()
    const theirs = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(theirs), { requestId: mine }),
      /InResponseTo/
    )
    const user = await service.validateSamlAssertion(response(mine), { requestId: mine })
    assert.equal(user.email, 'alice@example.test')
  })

  test('rejects a Response InResponseTo that differs from the assertion', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    const other = await service.createSamlRequestId()
    await rejects(
      service.validateSamlAssertion(response(requestId, {}, { inResponseTo: other })),
      /InResponseTo/
    )
  })

  test('refuses IdP-initiated (unsolicited) responses by default', async () => {
    const service = await configure()
    await rejects(service.validateSamlAssertion(response(null)), /IdP-initiated/)
  })

  test('refuses an unsolicited response when the host expects a request', async () => {
    const service = await configure({ allowIdpInitiated: true })
    const requestId = await service.createSamlRequestId()
    await rejects(service.validateSamlAssertion(response(null), { requestId }), /InResponseTo/)
  })

  test('accepts IdP-initiated responses when sso.allowIdpInitiated is on', async ({ assert }) => {
    const service = await configure({ allowIdpInitiated: true })
    const user = await service.validateSamlAssertion(response(null))
    assert.equal(user.email, 'alice@example.test')
  })

  // ----- Replay -------------------------------------------------------

  test('rejects a replayed assertion ID', async ({ assert }) => {
    const service = await configure({ allowIdpInitiated: true })
    const notOnOrAfter = ahead(5 * 60_000)
    const message = response(null, {
      id: '_replay-me',
      notOnOrAfter,
      confirmationNotOnOrAfter: notOnOrAfter,
    })

    await service.validateSamlAssertion(message)
    await rejects(service.validateSamlAssertion(message), /already been used/)

    // A fresh response carrying the same assertion ID is a replay too.
    await rejects(
      service.validateSamlAssertion(response(null, { id: '_replay-me' })),
      /already been used/
    )

    // The ID is kept until the assertion would have expired anyway.
    const row = await running.db
      .from('escalated_sso_message_ids')
      .where('kind', 'assertion')
      .where('message_id', '_replay-me')
      .first()
    assert.isAtLeast(Number(row.expires_at), Math.floor(Date.parse(notOnOrAfter) / 1000))
  })

  test('rejects a replayed SP-initiated response as a replay', async () => {
    const service = await configure()
    const requestId = await service.createSamlRequestId()
    const message = response(requestId)
    await service.validateSamlAssertion(message)
    await rejects(service.validateSamlAssertion(message), /already been used/)
  })

  test('forgets used assertion IDs once they have expired', async ({ assert }) => {
    const service = await configure({ allowIdpInitiated: true })
    await running.db.table('escalated_sso_message_ids').insert({
      kind: 'assertion',
      message_id: '_long-gone',
      expires_at: Math.floor(Date.now() / 1000) - 60,
    })
    await service.validateSamlAssertion(response(null))
    const row = await running.db
      .from('escalated_sso_message_ids')
      .where('message_id', '_long-gone')
      .first()
    assert.notExists(row)
  })

  // ----- Configuration ------------------------------------------------

  test('refuses every response until the IdP entity ID is configured', async () => {
    const service = await configure({ allowIdpInitiated: true }, { sso_entity_id: '' })
    await rejects(service.validateSamlAssertion(response(null)), /sso_entity_id/)
  })

  test('defaults the SP entity ID and ACS URL to the metadata and ACS routes', async ({
    assert,
  }) => {
    const service = await configure({
      spEntityId: undefined,
      acsUrl: undefined,
      baseUrl: 'https://help.example.test',
    })
    const metadata = 'https://help.example.test/support/sso/saml/metadata'
    const acs = 'https://help.example.test/support/sso/saml/acs'
    assert.equal(service.endpoints().sp_entity_id, metadata)
    assert.equal(service.endpoints().acs, acs)

    const requestId = await service.createSamlRequestId()
    const user = await service.validateSamlAssertion(
      response(requestId, { audiences: [metadata], recipient: acs }, { destination: acs })
    )
    assert.equal(user.email, 'alice@example.test')

    const second = await service.createSamlRequestId()
    await rejects(service.validateSamlAssertion(response(second)), /Audience/)
  })

  test('a stored setting cannot allow IdP-initiated responses', async () => {
    const service = await configure(
      {},
      { sso_allow_idp_initiated: '1', sso_clock_skew: '300', sso_sp_entity_id: 'x' }
    )
    await rejects(service.validateSamlAssertion(response(null)), /IdP-initiated/)
  })

  group.teardown(async () => {
    setSso(undefined)
    await running.db.from('escalated_settings').whereLike('key', 'sso_%').delete()
    await running.db.from('escalated_sso_message_ids').delete()
  })
})
