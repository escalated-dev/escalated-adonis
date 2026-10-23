import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { SignedXml } from 'xml-crypto'

/*
|--------------------------------------------------------------------------
| SAML test messages
|--------------------------------------------------------------------------
|
| Builds SAML 2.0 responses the way an IdP sends them and signs them with the
| throwaway IdP key under fixtures/saml.
|
*/

const FIXTURES = new URL('../fixtures/saml/', import.meta.url)
export const IDP_KEY = readFileSync(new URL('idp-test-key.pem', FIXTURES), 'utf-8')
export const IDP_CERT = readFileSync(new URL('idp-test-cert.pem', FIXTURES), 'utf-8')
export const IDP_CERT_BODY = IDP_CERT.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(
  /\s+/g,
  ''
)

/** The IdP's entity ID (`sso_entity_id`, the assertion's Issuer). */
export const IDP_ENTITY_ID = 'https://idp.example.test/metadata'
/** Our service provider's entity ID (`sso_sp_entity_id`, the Audience). */
export const SP_ENTITY_ID = 'https://help.example.test/saml/metadata'
/** Our ACS URL (`sso_acs_url`, the Destination and Recipient). */
export const ACS_URL = 'https://help.example.test/saml/acs'

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

export type AssertionOptions = {
  email?: string
  id?: string
  issuer?: string
  /** Audiences in one AudienceRestriction; `null` leaves the restriction out. */
  audiences?: string[] | null
  notBefore?: string | null
  notOnOrAfter?: string | null
  recipient?: string | null
  inResponseTo?: string | null
  confirmationNotBefore?: string | null
  confirmationNotOnOrAfter?: string | null
  /** `null` leaves the SubjectConfirmation out. */
  confirmationMethod?: string | null
}

export function assertionXml(options: AssertionOptions = {}) {
  const email = options.email ?? 'alice@example.test'
  const id = options.id ?? `_a${randomUUID()}`
  const issuer = options.issuer ?? IDP_ENTITY_ID
  const audiences = options.audiences === undefined ? [SP_ENTITY_ID] : options.audiences
  const notBefore = options.notBefore === undefined ? iso(-60_000) : options.notBefore
  const notOnOrAfter = options.notOnOrAfter === undefined ? iso(5 * 60_000) : options.notOnOrAfter
  const recipient = options.recipient === undefined ? ACS_URL : options.recipient
  const confirmationNotOnOrAfter =
    options.confirmationNotOnOrAfter === undefined
      ? iso(5 * 60_000)
      : options.confirmationNotOnOrAfter
  const method =
    options.confirmationMethod === undefined
      ? 'urn:oasis:names:tc:SAML:2.0:cm:bearer'
      : options.confirmationMethod

  const attr = (name: string, value: string | null | undefined) =>
    value === null || value === undefined ? '' : ` ${name}="${value}"`

  const confirmation =
    method === null
      ? ''
      : `<saml:SubjectConfirmation Method="${method}">` +
        `<saml:SubjectConfirmationData` +
        attr('Recipient', recipient) +
        attr('InResponseTo', options.inResponseTo) +
        attr('NotBefore', options.confirmationNotBefore) +
        attr('NotOnOrAfter', confirmationNotOnOrAfter) +
        `/></saml:SubjectConfirmation>`

  const restriction =
    audiences === null
      ? ''
      : `<saml:AudienceRestriction>${audiences
          .map((audience) => `<saml:Audience>${audience}</saml:Audience>`)
          .join('')}</saml:AudienceRestriction>`

  return (
    `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" IssueInstant="${iso(0)}">` +
    `<saml:Issuer>${issuer}</saml:Issuer>` +
    `<saml:Subject><saml:NameID>${email}</saml:NameID>${confirmation}</saml:Subject>` +
    `<saml:Conditions${attr('NotBefore', notBefore)}${attr('NotOnOrAfter', notOnOrAfter)}>` +
    restriction +
    `</saml:Conditions>` +
    `<saml:AttributeStatement>` +
    `<saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>` +
    `<saml:Attribute Name="name"><saml:AttributeValue>Signed User</saml:AttributeValue></saml:Attribute>` +
    `</saml:AttributeStatement>` +
    `</saml:Assertion>`
  )
}

export type ResponseOptions = {
  destination?: string | null
  inResponseTo?: string | null
}

export function responseXml(inner: string, options: ResponseOptions = {}) {
  const destination = options.destination === undefined ? ACS_URL : options.destination
  return (
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r${randomUUID()}" Version="2.0" IssueInstant="${iso(0)}"` +
    (destination === null ? '' : ` Destination="${destination}"`) +
    (options.inResponseTo ? ` InResponseTo="${options.inResponseTo}"` : '') +
    `>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    inner +
    `</samlp:Response>`
  )
}

/** Signs the element `target` (Assertion or Response) as an IdP would. */
export function sign(
  xml: string,
  target: 'Assertion' | 'Response',
  privateKey: string = IDP_KEY,
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

export const b64 = (xml: string) => Buffer.from(xml, 'utf-8').toString('base64')

/** Awaits `promise` and checks it was refused with an SsoValidationError matching `message`. */
export async function rejects(promise: Promise<unknown>, message: RegExp) {
  // Settle the promise before any other await, so its rejection is never unhandled.
  const outcome = await promise.then(
    () => ({ rejected: false as const }),
    (error: unknown) => ({ rejected: true as const, error })
  )
  const { SsoValidationError } = await import('../../../src/services/sso_service.js')
  if (!outcome.rejected) throw new Error('Expected the SAML response to be rejected')
  if (!(outcome.error instanceof SsoValidationError)) throw outcome.error
  if (!message.test(outcome.error.message)) {
    throw new Error(`Unexpected rejection: ${outcome.error.message}`)
  }
}
