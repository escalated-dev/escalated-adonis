import { test } from '@japa/runner'
import { generateKeyPairSync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { SignedXml } from 'xml-crypto'
import { testApp, type TestApp } from './helpers/app.js'

/*
|--------------------------------------------------------------------------
| SAML assertions must be signed by the configured IdP
|--------------------------------------------------------------------------
|
| SsoService.validateSamlAssertion read the email out of whatever XML it was
| handed: anyone could post an unsigned assertion naming any user. It now
| verifies the XML signature against `sso_certificate` (and refuses to sign
| anyone in when no certificate is configured), never trusts a key carried in
| the message, and reads the user only from the XML the signature covers.
|
| The IdP key and certificate under fixtures/saml are throwaway test material.
|
*/

const FIXTURES = new URL('./fixtures/saml/', import.meta.url)
const IDP_KEY = readFileSync(new URL('idp-test-key.pem', FIXTURES), 'utf-8')
const IDP_CERT = readFileSync(new URL('idp-test-cert.pem', FIXTURES), 'utf-8')
const IDP_CERT_BODY = IDP_CERT.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '')

const ATTACKER = generateKeyPairSync('rsa', { modulusLength: 2048 })
const ATTACKER_KEY = ATTACKER.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const ATTACKER_PUBLIC = ATTACKER.publicKey.export({ type: 'spki', format: 'pem' }).toString()

const ENTITY_ID = 'https://idp.example.test/metadata'

function assertionXml(email: string, id = '_a1', issuer = ENTITY_ID, notOnOrAfter?: string) {
  const until = notOnOrAfter ?? new Date(Date.now() + 5 * 60_000).toISOString()
  return (
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" IssueInstant="${new Date().toISOString()}">` +
    `<saml:Issuer>${issuer}</saml:Issuer>` +
    `<saml:Subject><saml:NameID>${email}</saml:NameID></saml:Subject>` +
    `<saml:Conditions NotBefore="${new Date(Date.now() - 60_000).toISOString()}" NotOnOrAfter="${until}"/>` +
    `<saml:AttributeStatement>` +
    `<saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>` +
    `<saml:Attribute Name="name"><saml:AttributeValue>Signed User</saml:AttributeValue></saml:Attribute>` +
    `</saml:AttributeStatement>` +
    `</saml:Assertion>`
  )
}

function responseXml(inner: string) {
  return (
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r1" Version="2.0" IssueInstant="${new Date().toISOString()}">` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    inner +
    `</samlp:Response>`
  )
}

/** Signs the element `target` (Assertion or Response) as an IdP would. */
function sign(
  xml: string,
  target: 'Assertion' | 'Response',
  privateKey: string,
  embedPublicCert?: string
) {
  const signer = new SignedXml({
    privateKey,
    publicCert: embedPublicCert,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  })
  signer.addReference({
    xpath: `//*[local-name(.)='${target}']`,
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  })
  signer.computeSignature(xml, {
    location: {
      reference:
        target === 'Assertion'
          ? "//*[local-name(.)='Assertion']/*[local-name(.)='Issuer']"
          : "//*[local-name(.)='Response']/*[local-name(.)='Status']",
      action: target === 'Assertion' ? 'after' : 'before',
    },
  })
  return signer.getSignedXml()
}

const b64 = (xml: string) => Buffer.from(xml, 'utf-8').toString('base64')

test.group('SAML assertion signatures', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  async function configure(certificate: string) {
    const { default: SsoService } = await import('../../src/services/sso_service.js')
    const service = new SsoService()
    await service.saveConfig({
      sso_provider: 'saml',
      sso_entity_id: ENTITY_ID,
      sso_certificate: certificate,
      sso_attr_email: 'email',
      sso_attr_name: 'name',
    })
    return service
  }

  async function rejects(promise: Promise<unknown>, message: RegExp) {
    // Settle the promise before any other await, so its rejection is never unhandled.
    const outcome = await promise.then(
      () => ({ rejected: false as const }),
      (error: unknown) => ({ rejected: true as const, error })
    )
    const { SsoValidationError } = await import('../../src/services/sso_service.js')
    if (!outcome.rejected) throw new Error('Expected the SAML response to be rejected')
    if (!(outcome.error instanceof SsoValidationError)) throw outcome.error
    if (!message.test(outcome.error.message)) {
      throw new Error(`Unexpected rejection: ${outcome.error.message}`)
    }
  }

  test('accepts an assertion signed by the configured IdP certificate', async ({ assert }) => {
    const service = await configure(IDP_CERT_BODY)
    const signed = sign(responseXml(assertionXml('alice@example.test')), 'Assertion', IDP_KEY)

    const user = await service.validateSamlAssertion(b64(signed))
    assert.equal(user.email, 'alice@example.test')
    assert.equal(user.name, 'Signed User')
  })

  test('accepts a signed Response and a PEM certificate', async ({ assert }) => {
    const service = await configure(IDP_CERT)
    const signed = sign(responseXml(assertionXml('bob@example.test')), 'Response', IDP_KEY)

    const user = await service.validateSamlAssertion(b64(signed))
    assert.equal(user.email, 'bob@example.test')
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
          ENTITY_ID,
          new Date(Date.now() - 3_600_000).toISOString()
        )
      ),
      'Assertion',
      IDP_KEY
    )
    await rejects(service.validateSamlAssertion(b64(expired)), /expired/)
  })

  group.teardown(async () => {
    await running.db.from('escalated_settings').whereLike('key', 'sso_%').delete()
  })
})
