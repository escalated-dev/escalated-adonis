import {
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  type KeyObject,
} from 'node:crypto'
import { DOMParser, type Element } from '@xmldom/xmldom'
import { SignedXml } from 'xml-crypto'
import EscalatedSetting from '../models/escalated_setting.js'
import { escalatedDb } from '../helpers/config.js'

export class SsoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsoValidationError'
  }
}

interface SsoConfig {
  sso_provider: string
  sso_entity_id: string
  sso_url: string
  sso_certificate: string
  sso_attr_email: string
  sso_attr_name: string
  sso_attr_role: string
  sso_jwt_secret: string
  sso_jwt_algorithm: string
  sso_sp_entity_id: string
  sso_acs_url: string
  sso_allow_idp_initiated: string
  sso_clock_skew: string
}

export interface SamlValidationOptions {
  /**
   * The AuthnRequest ID the host kept for this browser (for example in its
   * session) when it sent the user to the IdP. When given, the response must
   * answer exactly that request.
   */
  requestId?: string
}

interface SsoUserResult {
  email: string
  name: string
  role: string
  claims?: Record<string, unknown>
  attributes?: Record<string, string>
}

const CONFIG_KEYS: (keyof SsoConfig)[] = [
  'sso_provider',
  'sso_entity_id',
  'sso_url',
  'sso_certificate',
  'sso_attr_email',
  'sso_attr_name',
  'sso_attr_role',
  'sso_jwt_secret',
  'sso_jwt_algorithm',
  'sso_sp_entity_id',
  'sso_acs_url',
  'sso_allow_idp_initiated',
  'sso_clock_skew',
]

const SAML_ASSERTION_NS = 'urn:oasis:names:tc:SAML:2.0:assertion'
const SAML_PROTOCOL_NS = 'urn:oasis:names:tc:SAML:2.0:protocol'
const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#'
const BEARER_METHOD = 'urn:oasis:names:tc:SAML:2.0:cm:bearer'

const SAML_IDS_TABLE = 'escalated_saml_message_ids'
/** Default clock skew, in seconds, for SAML validity windows. */
const DEFAULT_CLOCK_SKEW = 120
/** The largest clock skew `sso_clock_skew` may set, in seconds. */
const MAX_CLOCK_SKEW = 300
/** How long an issued AuthnRequest ID can be answered, in seconds. */
const DEFAULT_REQUEST_TTL = 600
/** Longest SAML ID the store holds (its column width). */
const MAX_MESSAGE_ID_LENGTH = 191

const DEFAULTS: SsoConfig = {
  sso_provider: 'none',
  sso_entity_id: '',
  sso_url: '',
  sso_certificate: '',
  sso_attr_email: 'email',
  sso_attr_name: 'name',
  sso_attr_role: 'role',
  sso_jwt_secret: '',
  sso_jwt_algorithm: 'HS256',
  sso_sp_entity_id: '',
  sso_acs_url: '',
  sso_allow_idp_initiated: '0',
  sso_clock_skew: String(DEFAULT_CLOCK_SKEW),
}

export default class SsoService {
  async getConfig(): Promise<SsoConfig> {
    const config: Record<string, string> = {}
    for (const key of CONFIG_KEYS) {
      config[key] = (await EscalatedSetting.get(key, DEFAULTS[key])) ?? DEFAULTS[key]
    }
    return config as unknown as SsoConfig
  }

  async saveConfig(data: Partial<SsoConfig>): Promise<void> {
    for (const key of CONFIG_KEYS) {
      if (key in data) {
        await EscalatedSetting.set(key, String(data[key]))
      }
    }
  }

  async isEnabled(): Promise<boolean> {
    return (await this.getProvider()) !== 'none'
  }

  async getProvider(): Promise<string> {
    return (await EscalatedSetting.get('sso_provider', 'none')) ?? 'none'
  }

  // -----------------------------------------------------------------
  // SAML Assertion Validation
  // -----------------------------------------------------------------

  /**
   * Validates a base64 SAML 2.0 Response and returns the signed-in user.
   *
   * The assertion (or the Response that carries it) must carry an XML
   * signature that verifies against the IdP certificate configured as
   * `sso_certificate`; without one configured, nobody is signed in. A key
   * carried in the message's KeyInfo is never trusted. The user is read from
   * the XML the signature covers, not from the document as received, and a
   * response with more than one assertion is refused, so an unsigned
   * assertion cannot ride along with a signed one.
   *
   * The assertion must also be meant for this service provider, for this
   * sign-in, now and once: our SP entity ID (`sso_sp_entity_id`) in every
   * AudienceRestriction, our ACS URL (`sso_acs_url`) as the Response
   * Destination and the bearer confirmation's Recipient, Conditions and
   * confirmation times inside the window (`sso_clock_skew` seconds of skew),
   * an InResponseTo naming a request from `createSamlRequestId()` that has
   * not been answered yet (unsolicited responses only when
   * `sso_allow_idp_initiated` is on), and an assertion ID not accepted
   * before.
   */
  async validateSamlAssertion(
    samlResponse: string,
    options: SamlValidationOptions = {}
  ): Promise<SsoUserResult> {
    const config = await this.getConfig()
    const idpKey = this.samlIdpKey(config.sso_certificate)
    const spEntityId = (config.sso_sp_entity_id || '').trim()
    if (!spEntityId) {
      throw new SsoValidationError(
        'SAML sign-in is disabled: no service provider entity ID (sso_sp_entity_id) is configured to check the assertion Audience.'
      )
    }
    const acsUrl = (config.sso_acs_url || '').trim()
    if (!acsUrl) {
      throw new SsoValidationError(
        'SAML sign-in is disabled: no ACS URL (sso_acs_url) is configured to check the Destination and Recipient.'
      )
    }
    const skew = this.clockSkew(config.sso_clock_skew)
    const now = Math.floor(Date.now() / 1000)

    const xml = Buffer.from(samlResponse || '', 'base64').toString('utf-8')
    const doc = this.parseXml(xml)

    if (doc.getElementsByTagNameNS(SAML_ASSERTION_NS, 'EncryptedAssertion').length > 0) {
      throw new SsoValidationError('Encrypted SAML assertions are not supported.')
    }
    if (doc.getElementsByTagNameNS(SAML_ASSERTION_NS, 'Assertion').length !== 1) {
      throw new SsoValidationError('SAML response must contain exactly one assertion.')
    }

    const root = doc.documentElement as Element
    const assertion = this.verifiedSamlAssertion(xml, root, idpKey)

    // Check issuer
    const entityId = (config.sso_entity_id || '').trim()
    if (entityId) {
      const issuerEl = this.childElements(assertion, SAML_ASSERTION_NS, 'Issuer')[0]
      if (!issuerEl) {
        throw new SsoValidationError('SAML assertion missing Issuer element.')
      }
      const issuer = (issuerEl.textContent || '').trim()
      if (issuer !== entityId) {
        throw new SsoValidationError(
          `SAML Issuer mismatch: expected '${entityId}', got '${issuer}'.`
        )
      }
    }

    // Validity window and audience
    const conditions = this.childElements(assertion, SAML_ASSERTION_NS, 'Conditions')[0]
    if (!conditions) {
      throw new SsoValidationError('SAML assertion missing Conditions (and so its Audience).')
    }
    const conditionsUntil = this.validateSamlWindow(conditions, now, skew, 'assertion')
    this.validateSamlAudience(conditions, spEntityId)

    // Destination, on the Response as received. When only the assertion is
    // signed this attribute is not covered by the signature, so the signed
    // Recipient below is what binds the assertion to our ACS URL; a wrong
    // Destination is refused all the same.
    const isResponse = this.isElement(root, SAML_PROTOCOL_NS, 'Response')
    const destination = isResponse ? root.getAttribute('Destination') : null
    if (destination !== null && destination !== '' && destination !== acsUrl) {
      throw new SsoValidationError(
        `SAML Destination mismatch: expected '${acsUrl}', got '${destination}'.`
      )
    }

    // Bearer subject confirmation: Recipient, window and InResponseTo
    const confirmation = this.bearerConfirmation(assertion, acsUrl, now, skew)
    const inResponseTo = confirmation.inResponseTo
    const responseInResponseTo = isResponse ? root.getAttribute('InResponseTo') : null
    if (responseInResponseTo && responseInResponseTo !== inResponseTo) {
      throw new SsoValidationError(
        'SAML InResponseTo mismatch between the Response and its assertion.'
      )
    }
    if (inResponseTo) {
      if (options.requestId !== undefined && inResponseTo !== options.requestId) {
        throw new SsoValidationError(
          'SAML InResponseTo does not match the request this sign-in started.'
        )
      }
    } else if (options.requestId !== undefined) {
      throw new SsoValidationError(
        'SAML response has no InResponseTo, but this sign-in started with a request.'
      )
    } else if (!this.truthy(config.sso_allow_idp_initiated)) {
      throw new SsoValidationError(
        'SAML response answers no request we issued, and IdP-initiated sign-in (sso_allow_idp_initiated) is off.'
      )
    }

    // Replay, then the request it answers. The assertion ID is kept until the
    // assertion could no longer be accepted anyway.
    const assertionId = assertion.getAttribute('ID') || ''
    if (!assertionId) {
      throw new SsoValidationError('SAML assertion missing ID.')
    }
    const usableUntil = Math.max(conditionsUntil ?? 0, confirmation.notOnOrAfter) + skew
    await this.recordAssertionId(assertionId, usableUntil, now)
    if (inResponseTo) {
      await this.consumeRequestId(inResponseTo, now)
    }

    // Extract attributes
    const attributes = this.extractSamlAttributes(assertion)

    let email = attributes[config.sso_attr_email || 'email']
    if (!email) {
      const nameIdEls = assertion.getElementsByTagNameNS(SAML_ASSERTION_NS, 'NameID')
      if (nameIdEls.length > 0) {
        email = (nameIdEls[0].textContent || '').trim()
      }
    }

    if (!email) {
      throw new SsoValidationError('SAML assertion missing email attribute.')
    }

    return {
      email,
      name: attributes[config.sso_attr_name || 'name'] || '',
      role: attributes[config.sso_attr_role || 'role'] || '',
      attributes,
    }
  }

  /**
   * The configured IdP certificate as a public key. Accepts a PEM certificate
   * or public key, or the bare base64 certificate body most IdPs show.
   * Refuses when none is configured: SAML never signs anyone in without
   * verifying the signature.
   */
  private samlIdpKey(certificate: string): KeyObject {
    const raw = (certificate || '').trim()
    if (!raw) {
      throw new SsoValidationError(
        'SAML sign-in is disabled: no IdP certificate (sso_certificate) is configured to verify assertions.'
      )
    }
    if (raw.includes('PRIVATE KEY')) {
      throw new SsoValidationError('The SAML IdP certificate must not be a private key.')
    }
    const pem = raw.includes('-----BEGIN')
      ? raw
      : [
          '-----BEGIN CERTIFICATE-----',
          ...(raw.replace(/\s+/g, '').match(/.{1,64}/g) ?? []),
          '-----END CERTIFICATE-----',
          '',
        ].join('\n')
    try {
      return createPublicKey(pem)
    } catch {
      throw new SsoValidationError('The configured SAML IdP certificate could not be read.')
    }
  }

  private parseXml(xml: string) {
    let doc
    try {
      doc = new DOMParser({ onError: () => {} }).parseFromString(xml, 'text/xml')
    } catch {
      doc = null
    }
    if (!doc || !doc.documentElement) {
      throw new SsoValidationError('Invalid SAML response: malformed XML.')
    }
    return doc
  }

  /**
   * Verifies the signature on the assertion, else on the Response, against
   * the IdP key and returns the assertion parsed from the signed XML itself.
   */
  private verifiedSamlAssertion(xml: string, root: Element, idpKey: KeyObject): Element {
    const assertion =
      root.getElementsByTagNameNS(SAML_ASSERTION_NS, 'Assertion')[0] ??
      (this.isElement(root, SAML_ASSERTION_NS, 'Assertion') ? root : undefined)
    if (!assertion) {
      throw new SsoValidationError('SAML response must contain exactly one assertion.')
    }

    const signatures: Element[] = [
      ...this.childElements(assertion, XMLDSIG_NS, 'Signature'),
      ...(this.isElement(root, SAML_PROTOCOL_NS, 'Response')
        ? this.childElements(root, XMLDSIG_NS, 'Signature')
        : []),
    ]
    if (signatures.length === 0) {
      throw new SsoValidationError('SAML response is not signed.')
    }

    for (const signature of signatures) {
      const verifier = new SignedXml({ publicCert: idpKey, getCertFromKeyInfo: () => null })
      let signed: string[] = []
      try {
        verifier.loadSignature(signature as unknown as Parameters<SignedXml['loadSignature']>[0])
        if (verifier.checkSignature(xml)) signed = verifier.getSignedReferences()
      } catch {
        signed = []
      }
      if (signed.length !== 1) continue

      const signedRoot = this.parseXml(signed[0]).documentElement as Element
      if (this.isElement(signedRoot, SAML_ASSERTION_NS, 'Assertion')) {
        return signedRoot
      }
      if (this.isElement(signedRoot, SAML_PROTOCOL_NS, 'Response')) {
        const assertions = this.childElements(signedRoot, SAML_ASSERTION_NS, 'Assertion')
        if (assertions.length === 1) return assertions[0]
      }
    }

    throw new SsoValidationError('SAML signature verification failed.')
  }

  private isElement(node: Element | null | undefined, ns: string, localName: string): boolean {
    return !!node && node.namespaceURI === ns && node.localName === localName
  }

  private childElements(parent: Element, ns: string, localName: string): Element[] {
    return (Array.from(parent.childNodes) as unknown as Element[]).filter((node) =>
      this.isElement(node, ns, localName)
    )
  }

  private truthy(value: string | null | undefined): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      String(value ?? '')
        .trim()
        .toLowerCase()
    )
  }

  /** `sso_clock_skew` in seconds: two minutes by default, at most five. */
  private clockSkew(value: string | null | undefined): number {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10)
    if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CLOCK_SKEW
    return Math.min(parsed, MAX_CLOCK_SKEW)
  }

  /** A SAML dateTime as Unix seconds; refuses one that does not parse. */
  private samlTime(value: string, attribute: string): number {
    const ms = Date.parse(value)
    if (Number.isNaN(ms)) {
      throw new SsoValidationError(`SAML ${attribute} is not a valid time.`)
    }
    return Math.floor(ms / 1000)
  }

  /**
   * Checks NotBefore / NotOnOrAfter on `el` with `skew` seconds of leeway and
   * returns NotOnOrAfter (Unix seconds) when it is set.
   */
  private validateSamlWindow(
    el: Element,
    now: number,
    skew: number,
    what: 'assertion' | 'subject confirmation'
  ): number | null {
    const notBefore = el.getAttribute('NotBefore')
    if (notBefore && this.samlTime(notBefore, 'NotBefore') > now + skew) {
      throw new SsoValidationError(`SAML ${what} is not yet valid.`)
    }

    const notOnOrAfter = el.getAttribute('NotOnOrAfter')
    if (!notOnOrAfter) return null
    const until = this.samlTime(notOnOrAfter, 'NotOnOrAfter')
    if (now >= until + skew) {
      throw new SsoValidationError(`SAML ${what} has expired.`)
    }
    return until
  }

  /** There must be an AudienceRestriction, and every one must name our SP entity ID. */
  private validateSamlAudience(conditions: Element, spEntityId: string): void {
    const restrictions = this.childElements(conditions, SAML_ASSERTION_NS, 'AudienceRestriction')
    if (restrictions.length === 0) {
      throw new SsoValidationError(
        'SAML assertion has no AudienceRestriction naming this service provider.'
      )
    }
    for (const restriction of restrictions) {
      const audiences = this.childElements(restriction, SAML_ASSERTION_NS, 'Audience').map(
        (audience) => (audience.textContent || '').trim()
      )
      if (!audiences.includes(spEntityId)) {
        throw new SsoValidationError(
          `SAML Audience mismatch: '${spEntityId}' is not an audience of this assertion.`
        )
      }
    }
  }

  /**
   * The first bearer SubjectConfirmation addressed to our ACS URL and valid
   * now. When none qualifies, the reason the first one fails is reported.
   */
  private bearerConfirmation(
    assertion: Element,
    acsUrl: string,
    now: number,
    skew: number
  ): { inResponseTo: string | null; notOnOrAfter: number } {
    const subject = this.childElements(assertion, SAML_ASSERTION_NS, 'Subject')[0]
    const bearers = subject
      ? this.childElements(subject, SAML_ASSERTION_NS, 'SubjectConfirmation').filter(
          (confirmation) => confirmation.getAttribute('Method') === BEARER_METHOD
        )
      : []
    if (bearers.length === 0) {
      throw new SsoValidationError('SAML assertion has no bearer SubjectConfirmation.')
    }

    let firstError: SsoValidationError | null = null
    for (const bearer of bearers) {
      try {
        const data = this.childElements(bearer, SAML_ASSERTION_NS, 'SubjectConfirmationData')[0]
        if (!data) {
          throw new SsoValidationError('SAML SubjectConfirmation has no SubjectConfirmationData.')
        }
        const recipient = data.getAttribute('Recipient')
        if (recipient !== acsUrl) {
          throw new SsoValidationError(
            `SAML Recipient mismatch: expected '${acsUrl}', got '${recipient ?? ''}'.`
          )
        }
        const notOnOrAfter = this.validateSamlWindow(data, now, skew, 'subject confirmation')
        if (notOnOrAfter === null) {
          throw new SsoValidationError('SAML SubjectConfirmationData has no NotOnOrAfter.')
        }
        return { inResponseTo: data.getAttribute('InResponseTo') || null, notOnOrAfter }
      } catch (error) {
        if (!(error instanceof SsoValidationError)) throw error
        firstError ??= error
      }
    }
    throw firstError as SsoValidationError
  }

  // -----------------------------------------------------------------
  // SAML message IDs (issued requests, used assertions)
  // -----------------------------------------------------------------

  /**
   * Issues an ID for an AuthnRequest and remembers it for `ttlSeconds` (ten
   * minutes by default). Put it in the AuthnRequest's `ID`: the IdP's
   * response must name it in InResponseTo, and it can be answered once.
   * Keep it in the user's session as well and pass it to
   * `validateSamlAssertion(response, { requestId })` to tie the response to
   * the browser that started the sign-in.
   */
  async createSamlRequestId(ttlSeconds: number = DEFAULT_REQUEST_TTL): Promise<string> {
    const id = `_${randomBytes(20).toString('hex')}`
    const now = Math.floor(Date.now() / 1000)
    await this.pruneSamlIds(now)
    const db = await escalatedDb()
    await db.table(SAML_IDS_TABLE).insert({
      kind: 'request',
      message_id: id,
      expires_at: now + Math.max(1, Math.floor(ttlSeconds)),
    })
    return id
  }

  private async pruneSamlIds(now: number): Promise<void> {
    const db = await escalatedDb()
    await db.from(SAML_IDS_TABLE).where('expires_at', '<', now).delete()
  }

  /** Removes the issued request `id`; refuses one we never issued, already answered, or expired. */
  private async consumeRequestId(id: string, now: number): Promise<void> {
    const db = await escalatedDb()
    const deleted =
      id.length > MAX_MESSAGE_ID_LENGTH
        ? 0
        : await db
            .from(SAML_IDS_TABLE)
            .where('kind', 'request')
            .where('message_id', id)
            .where('expires_at', '>=', now)
            .delete()
    if (Number(deleted) !== 1) {
      throw new SsoValidationError(
        'SAML InResponseTo does not match a sign-in request we issued (unknown, expired or already answered).'
      )
    }
  }

  /** Records the assertion `id` as used until `until`; refuses one already used. */
  private async recordAssertionId(id: string, until: number, now: number): Promise<void> {
    if (id.length > MAX_MESSAGE_ID_LENGTH) {
      throw new SsoValidationError('SAML assertion ID is too long.')
    }
    await this.pruneSamlIds(now)
    const db = await escalatedDb()
    try {
      await db
        .table(SAML_IDS_TABLE)
        .insert({ kind: 'assertion', message_id: id, expires_at: until })
    } catch (error) {
      const existing = await db
        .from(SAML_IDS_TABLE)
        .where('kind', 'assertion')
        .where('message_id', id)
        .first()
      if (existing) {
        throw new SsoValidationError('SAML assertion has already been used.')
      }
      throw error
    }
  }

  private extractSamlAttributes(assertion: Element): Record<string, string> {
    const attributes: Record<string, string> = {}
    const attrEls = assertion.getElementsByTagNameNS(
      'urn:oasis:names:tc:SAML:2.0:assertion',
      'Attribute'
    )
    for (const attrEl of Array.from(attrEls) as Element[]) {
      const name = attrEl.getAttribute('Name')
      if (!name) continue
      const valueEls = attrEl.getElementsByTagNameNS(
        'urn:oasis:names:tc:SAML:2.0:assertion',
        'AttributeValue'
      )
      if (valueEls.length > 0) {
        attributes[name] = (valueEls[0].textContent || '').trim()
      }
    }
    return attributes
  }

  // -----------------------------------------------------------------
  // JWT Token Validation
  // -----------------------------------------------------------------

  async validateJwtToken(token: string): Promise<SsoUserResult> {
    const config = await this.getConfig()

    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new SsoValidationError('Invalid JWT: expected 3 segments.')
    }

    const [headerB64, payloadB64, signatureB64] = parts

    let header: Record<string, unknown>
    try {
      header = JSON.parse(this.base64UrlDecode(headerB64))
    } catch {
      throw new SsoValidationError('Invalid JWT: malformed header.')
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(this.base64UrlDecode(payloadB64))
    } catch {
      throw new SsoValidationError('Invalid JWT: malformed payload.')
    }

    const secret = config.sso_jwt_secret || ''
    const algorithm = config.sso_jwt_algorithm || 'HS256'
    if (!secret) {
      throw new SsoValidationError('JWT secret is not configured.')
    }

    const signature = Buffer.from(this.base64UrlDecode(signatureB64), 'binary')
    const signingInput = `${headerB64}.${payloadB64}`

    if (!this.verifyJwtSignature(signingInput, signature, secret, algorithm)) {
      throw new SsoValidationError('Invalid JWT: signature verification failed.')
    }

    const now = Math.floor(Date.now() / 1000)
    const skew = 60

    if (payload.exp && (payload.exp as number) < now - skew) {
      throw new SsoValidationError('JWT has expired.')
    }

    if (payload.nbf && (payload.nbf as number) > now + skew) {
      throw new SsoValidationError('JWT is not yet valid.')
    }

    const attrEmail = config.sso_attr_email || 'email'
    const attrName = config.sso_attr_name || 'name'
    const attrRole = config.sso_attr_role || 'role'

    const email =
      (payload[attrEmail] as string) || (payload.email as string) || (payload.sub as string)
    if (!email) {
      throw new SsoValidationError('JWT missing email claim.')
    }

    return {
      email,
      name: (payload[attrName] as string) || (payload.name as string) || '',
      role: (payload[attrRole] as string) || (payload.role as string) || '',
      claims: payload,
    }
  }

  private verifyJwtSignature(
    signingInput: string,
    signature: Buffer,
    secret: string,
    algorithm: string
  ): boolean {
    const hmacAlgos: Record<string, string> = {
      HS256: 'sha256',
      HS384: 'sha384',
      HS512: 'sha512',
    }

    if (algorithm in hmacAlgos) {
      const expected = createHmac(hmacAlgos[algorithm], secret).update(signingInput).digest()
      return expected.length === signature.length && timingSafeEqual(expected, signature)
    }

    throw new SsoValidationError(`Unsupported JWT algorithm: ${algorithm}`)
  }

  private base64UrlDecode(str: string): string {
    let s = str.replace(/-/g, '+').replace(/_/g, '/')
    const pad = s.length % 4
    if (pad) s += '='.repeat(4 - pad)
    return Buffer.from(s, 'base64').toString('utf-8')
  }
}
