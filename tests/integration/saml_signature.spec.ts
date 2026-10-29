import { test } from '@japa/runner'
import { generateKeyPairSync } from 'node:crypto'
import { testApp, type TestApp } from './helpers/app.js'
import { setSso } from './helpers/access.js'
import {
  ACS_URL,
  IDP_CERT,
  IDP_CERT_BODY,
  IDP_ENTITY_ID,
  IDP_KEY,
  SP_ENTITY_ID,
  assertionXml as buildAssertion,
  b64,
  rejects,
  responseXml,
  sign,
} from './helpers/saml.js'

/*
|--------------------------------------------------------------------------
| SAML assertions must be signed by the configured IdP
|--------------------------------------------------------------------------
|
| SsoService.validateSamlAssertion read the email out of whatever XML it was
| handed: anyone could post an unsigned assertion naming any user. It now
| verifies the assertion's own XML signature against `sso_certificate` (and
| refuses to sign anyone in when no certificate is configured; a signed
| Response around an unsigned assertion is not enough), never trusts a key
| carried in the message, and reads the user only from the XML the signature
| covers.
|
| The IdP key and certificate under fixtures/saml are throwaway test material.
|
*/

const ATTACKER = generateKeyPairSync('rsa', { modulusLength: 2048 })
const ATTACKER_KEY = ATTACKER.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const ATTACKER_PUBLIC = ATTACKER.publicKey.export({ type: 'spki', format: 'pem' }).toString()

function assertionXml(email: string, id?: string, issuer?: string, notOnOrAfter?: string) {
  return buildAssertion({ email, id, issuer, notOnOrAfter })
}

test.group('SAML assertion signatures', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  async function configure(certificate: string) {
    const { default: SsoService } = await import('../../src/services/sso_service.js')
    const service = new SsoService()
    // These responses answer no AuthnRequest; saml_assertion_binding.spec.ts covers that.
    setSso({ spEntityId: SP_ENTITY_ID, acsUrl: ACS_URL, allowIdpInitiated: true })
    await service.saveConfig({
      sso_provider: 'saml',
      sso_entity_id: IDP_ENTITY_ID,
      sso_certificate: certificate,
      sso_attr_email: 'email',
      sso_attr_name: 'name',
    })
    return service
  }

  test('accepts an assertion signed by the configured IdP certificate', async ({ assert }) => {
    const service = await configure(IDP_CERT_BODY)
    const signed = sign(responseXml(assertionXml('alice@example.test')), 'Assertion', IDP_KEY)

    const user = await service.validateSamlAssertion(b64(signed))
    assert.equal(user.email, 'alice@example.test')
    assert.equal(user.name, 'Signed User')
  })

  test('accepts a PEM certificate', async ({ assert }) => {
    const service = await configure(IDP_CERT)
    const signed = sign(responseXml(assertionXml('bob@example.test')), 'Assertion', IDP_KEY)

    const user = await service.validateSamlAssertion(b64(signed))
    assert.equal(user.email, 'bob@example.test')
  })

  test('rejects a signed Response around an unsigned assertion', async () => {
    const service = await configure(IDP_CERT)
    const signed = sign(responseXml(assertionXml('bob@example.test')), 'Response', IDP_KEY)
    await rejects(service.validateSamlAssertion(b64(signed)), /assertion is not signed/)
  })

  test('rejects an unsigned assertion', async () => {
    const service = await configure(IDP_CERT_BODY)
    await rejects(
      service.validateSamlAssertion(b64(responseXml(assertionXml('mallory@example.test')))),
      /not signed/
    )
  })

  test('refuses to sign anyone in when no IdP certificate is configured', async () => {
    const service = await configure('')
    const signed = sign(responseXml(assertionXml('alice@example.test')), 'Assertion', IDP_KEY)
    await rejects(service.validateSamlAssertion(b64(signed)), /no IdP certificate/)
  })

  test('rejects an assertion signed by another key', async () => {
    const service = await configure(IDP_CERT_BODY)
    const forged = sign(
      responseXml(assertionXml('mallory@example.test')),
      'Assertion',
      ATTACKER_KEY
    )
    await rejects(service.validateSamlAssertion(b64(forged)), /signature verification failed/)
  })

  test('never trusts a key carried in the message KeyInfo', async () => {
    const service = await configure(IDP_CERT_BODY)
    const forged = sign(
      responseXml(assertionXml('mallory@example.test')),
      'Assertion',
      ATTACKER_KEY,
      ATTACKER_PUBLIC
    )
    await rejects(service.validateSamlAssertion(b64(forged)), /signature verification failed/)
  })

  test('rejects an assertion altered after signing', async () => {
    const service = await configure(IDP_CERT_BODY)
    const signed = sign(responseXml(assertionXml('alice@example.test')), 'Assertion', IDP_KEY)
    const tampered = signed.replaceAll('alice@example.test', 'mallory@example.test')
    await rejects(service.validateSamlAssertion(b64(tampered)), /signature verification failed/)
  })

  test('rejects an unsigned assertion wrapped around a signed one', async () => {
    const service = await configure(IDP_CERT_BODY)
    const signedAssertion = sign(assertionXml('alice@example.test'), 'Assertion', IDP_KEY)
    const wrapped = responseXml(assertionXml('mallory@example.test', '_evil') + signedAssertion)
    await rejects(service.validateSamlAssertion(b64(wrapped)), /exactly one assertion/)
  })

  test('rejects a signed assertion hidden inside an extension next to an unsigned one', async () => {
    const service = await configure(IDP_CERT_BODY)
    const signedAssertion = sign(assertionXml('alice@example.test'), 'Assertion', IDP_KEY)
    const wrapped = responseXml(
      `<samlp:Extensions>${signedAssertion}</samlp:Extensions>` +
        assertionXml('mallory@example.test', '_a1')
    )
    await rejects(service.validateSamlAssertion(b64(wrapped)), /exactly one assertion/)
  })

  test('still checks the issuer and expiry of a signed assertion', async () => {
    const service = await configure(IDP_CERT_BODY)
    const wrongIssuer = sign(
      responseXml(assertionXml('alice@example.test', '_a1', 'https://other.example.test')),
      'Assertion',
      IDP_KEY
    )
    await rejects(service.validateSamlAssertion(b64(wrongIssuer)), /Issuer mismatch/)

    const expired = sign(
      responseXml(
        assertionXml(
          'alice@example.test',
          '_a1',
          IDP_ENTITY_ID,
          new Date(Date.now() - 3_600_000).toISOString()
        )
      ),
      'Assertion',
      IDP_KEY
    )
    await rejects(service.validateSamlAssertion(b64(expired)), /expired/)
  })

  group.teardown(async () => {
    setSso(undefined)
    await running.db.from('escalated_settings').whereLike('key', 'sso_%').delete()
  })
})
