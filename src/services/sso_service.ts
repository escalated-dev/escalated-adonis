import { createPublicKey, randomBytes, type KeyObject } from 'node:crypto'
import { deflateRawSync } from 'node:zlib'
import { DOMParser, type Element } from '@xmldom/xmldom'
import { SignedXml } from 'xml-crypto'
import { importSPKI, importX509, jwtVerify, type JWTPayload } from 'jose'
import * as oauth from 'openid-client'
import EscalatedSetting from '../models/escalated_setting.js'
import { escalatedDb } from '../helpers/config.js'
import { ssoEnabled } from '../support/access_features.js'
import {
  ssoAcsUrl,
  ssoAllowIdpInitiated,
  ssoClockSkew,
  ssoConfig,
  ssoEndpoints,
  ssoJwtAudience,
  ssoOauthRedirectUrl,
  ssoSpEntityId,
  type SsoIdentity,
} from '../support/sso.js'

/*
|--------------------------------------------------------------------------
| Single sign-on
|--------------------------------------------------------------------------
|
| ADR 2026-10-29-configurable-access-features. The provider an admin picks in
| Admin > Settings > SSO (`sso_provider`: none, saml, oauth, jwt) signs users
| in through SsoController while `access.sso` is on. Crypto is left to
| maintained libraries: `xml-crypto` (XML signatures), `openid-client`
| (OAuth 2 / OIDC with PKCE) and `jose` (JWT).
|
| Every validate method returns `{ email, name, role }` or throws an
| SsoValidationError whose message is for the log, never for the user.
|
*/

export class SsoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsoValidationError'
  }
}

export type SsoProvider = 'none' | 'saml' | 'oauth' | 'jwt'

/** The runtime SSO settings (Admin > Settings > SSO), stored as `sso_*` keys. */
export interface SsoSettings {
  sso_provider: string
  sso_entity_id: string
  sso_url: string
  sso_login_url: string
  sso_logout_url: string
  sso_metadata_url: string
  sso_certificate: string
  sso_attr_email: string
  sso_attr_name: string
  sso_attr_role: string
  sso_jwt_secret: string
  sso_jwt_algorithm: string
  sso_oauth_authorize_url: string
  sso_oauth_token_url: string
  sso_oauth_userinfo_url: string
  sso_oauth_client_id: string
  sso_oauth_client_secret: string
  sso_oauth_scopes: string
}

export interface SamlValidationOptions {
  /**
   * The AuthnRequest ID the host kept for this browser when it sent the user
   * to the IdP. When given, the response must answer exactly that request.
   */
  requestId?: string
}

export const SSO_SETTING_DEFAULTS: SsoSettings = {
  sso_provider: 'none',
  sso_entity_id: '',
  sso_url: '',
  sso_login_url: '',
  sso_logout_url: '',
  sso_metadata_url: '',
  sso_certificate: '',
  sso_attr_email: 'email',
  sso_attr_name: 'name',
  sso_attr_role: 'role',
  sso_jwt_secret: '',
  sso_jwt_algorithm: 'HS256',
  sso_oauth_authorize_url: '',
  sso_oauth_token_url: '',
  sso_oauth_userinfo_url: '',
  sso_oauth_client_id: '',
  sso_oauth_client_secret: '',
  sso_oauth_scopes: 'openid profile email',
}

const CONFIG_KEYS = Object.keys(SSO_SETTING_DEFAULTS) as (keyof SsoSettings)[]

export const JWT_ALGORITHMS = ['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'] as const

const SAML_ASSERTION_NS = 'urn:oasis:names:tc:SAML:2.0:assertion'
const SAML_PROTOCOL_NS = 'urn:oasis:names:tc:SAML:2.0:protocol'
const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#'
const BEARER_METHOD = 'urn:oasis:names:tc:SAML:2.0:cm:bearer'

/** Issued AuthnRequest IDs, used assertion IDs and used JWT `jti`s. */
export const SSO_IDS_TABLE = 'escalated_sso_message_ids'
/** How long an issued AuthnRequest ID can be answered, in seconds. */
const DEFAULT_REQUEST_TTL = 600
/** Longest ID the store holds (its column width). */
const MAX_MESSAGE_ID_LENGTH = 191

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default class SsoService {
  async getConfig(): Promise<SsoSettings> {
    const config: Record<string, string> = {}
    for (const key of CONFIG_KEYS) {
      config[key] = (await EscalatedSetting.get(key, SSO_SETTING_DEFAULTS[key])) ?? ''
    }

    // `sso_url` is the single URL older releases stored for every provider.
    const legacyUrl = (config.sso_url || '').trim()
    if (legacyUrl) {
      if (!config.sso_login_url) config.sso_login_url = legacyUrl
      if (config.sso_provider === 'oauth' && !config.sso_oauth_authorize_url) {
        config.sso_oauth_authorize_url = legacyUrl
      }
      if (config.sso_provider === 'saml' && !config.sso_metadata_url) {
        config.sso_metadata_url = legacyUrl
      }
    }
    return config as unknown as SsoSettings
  }

  async saveConfig(data: Partial<SsoSettings>): Promise<void> {
    for (const key of CONFIG_KEYS) {
      if (key in data && data[key] !== undefined && data[key] !== null) {
        await EscalatedSetting.set(key, String(data[key]))
      }
    }
  }

  /** Whether SSO is switched on for the install and a provider is chosen. */
  async isEnabled(): Promise<boolean> {
    return ssoEnabled() && (await this.getProvider()) !== 'none'
  }

  async getProvider(): Promise<SsoProvider> {
    const provider = (await EscalatedSetting.get('sso_provider', 'none')) ?? 'none'
    return (['saml', 'oauth', 'jwt'] as const).includes(provider as any)
      ? (provider as SsoProvider)
      : 'none'
  }

  /** The URLs an admin gives the identity provider. */
  endpoints(): Record<string, string> {
    return ssoEndpoints()
  }

  // -----------------------------------------------------------------
  // SAML
  // -----------------------------------------------------------------

  /**
   * The IdP sign-in URL (HTTP-Redirect binding) for a new AuthnRequest. Its
   * ID is stored server-side and must come back as InResponseTo within ten
   * minutes. `relayState` is passed through the IdP unchanged.
   */
  async samlLoginUrl(relayState?: string): Promise<string> {
    const config = await this.getConfig()
    this.samlIdpKey(config.sso_certificate)
    const idpUrl = (config.sso_login_url || '').trim()
    if (!/^https?:\/\//i.test(idpUrl)) {
      throw new SsoValidationError('SAML sign-in has no IdP sign-in URL (sso_login_url).')
    }

    const id = await this.createSamlRequestId()
    const request =
      `<samlp:AuthnRequest xmlns:samlp="${SAML_PROTOCOL_NS}" xmlns:saml="${SAML_ASSERTION_NS}"` +
      ` ID="${id}" Version="2.0" IssueInstant="${new Date().toISOString()}"` +
      ` Destination="${xmlEscape(idpUrl)}"` +
      ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"` +
      ` AssertionConsumerServiceURL="${xmlEscape(ssoAcsUrl())}">` +
      `<saml:Issuer>${xmlEscape(ssoSpEntityId())}</saml:Issuer>` +
      `<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified" AllowCreate="true"/>` +
      `</samlp:AuthnRequest>`

    const url = new URL(idpUrl)
    url.searchParams.set('SAMLRequest', deflateRawSync(Buffer.from(request)).toString('base64'))
    if (relayState) url.searchParams.set('RelayState', relayState)
    return url.toString()
  }

  /** Our SP metadata: entity ID and HTTP-POST ACS, wanting signed assertions. */
  samlMetadata(): string {
    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${xmlEscape(ssoSpEntityId())}">` +
      `<md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="${SAML_PROTOCOL_NS}">` +
      `<md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified</md:NameIDFormat>` +
      `<md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${xmlEscape(ssoAcsUrl())}" index="1"/>` +
      `</md:SPSSODescriptor>` +
      `</md:EntityDescriptor>`
    )
  }

  /**
   * Validates a base64 SAML 2.0 Response and returns the signed-in identity.
   *
   * Refused unless: the IdP certificate (`sso_certificate`) is configured
   * and the assertion itself is signed by it (a key in KeyInfo is never
   * trusted; the user is read only from the XML the signature covers);
   * there is exactly one, unencrypted assertion; its Issuer is
   * `sso_entity_id`; every AudienceRestriction names our SP entity ID; the
   * Response Destination and the bearer Recipient are our ACS URL; the
   * Conditions and confirmation windows hold (`sso.clockSkew`); InResponseTo
   * names an unanswered AuthnRequest we issued (unsolicited responses only
   * with `sso.allowIdpInitiated`); and the assertion ID was not accepted
   * before.
   */
  async validateSamlAssertion(
    samlResponse: string,
    options: SamlValidationOptions = {}
  ): Promise<SsoIdentity> {
    const config = await this.getConfig()
    const idpKey = this.samlIdpKey(config.sso_certificate)
    const entityId = (config.sso_entity_id || '').trim()
    if (!entityId) {
      throw new SsoValidationError(
        'SAML sign-in is disabled: no IdP entity ID (sso_entity_id) is configured to check the Issuer.'
      )
    }
    const spEntityId = ssoSpEntityId()
    const acsUrl = ssoAcsUrl()
    const skew = ssoClockSkew()
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

    const issuerEl = this.childElements(assertion, SAML_ASSERTION_NS, 'Issuer')[0]
    if (!issuerEl) {
      throw new SsoValidationError('SAML assertion missing Issuer element.')
    }
    const issuer = (issuerEl.textContent || '').trim()
    if (issuer !== entityId) {
      throw new SsoValidationError(`SAML Issuer mismatch: expected '${entityId}', got '${issuer}'.`)
    }

    // Validity window and audience
    const conditions = this.childElements(assertion, SAML_ASSERTION_NS, 'Conditions')[0]
    if (!conditions) {
      throw new SsoValidationError('SAML assertion missing Conditions (and so its Audience).')
    }
    const conditionsUntil = this.validateSamlWindow(conditions, now, skew, 'assertion')
    this.validateSamlAudience(conditions, spEntityId)

    // Destination, on the Response as received. The assertion's signature
    // does not cover it, so the signed Recipient below is what binds the
    // assertion to our ACS URL; a wrong or empty Destination is refused all
    // the same.
    const isResponse = this.isElement(root, SAML_PROTOCOL_NS, 'Response')
    const destination = isResponse ? root.getAttribute('Destination') : null
    if (destination !== null && destination !== acsUrl) {
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
    } else if (!ssoAllowIdpInitiated()) {
      throw new SsoValidationError(
        'SAML response answers no request we issued, and IdP-initiated sign-in (sso.allowIdpInitiated) is off.'
      )
    }

    // Replay, then the request it answers. The assertion ID is kept until the
    // assertion could no longer be accepted anyway.
    const assertionId = assertion.getAttribute('ID') || ''
    if (!assertionId) {
      throw new SsoValidationError('SAML assertion missing ID.')
    }
    const usableUntil = Math.max(conditionsUntil ?? 0, confirmation.notOnOrAfter) + skew
    await this.claimMessageId(
      'assertion',
      assertionId,
      usableUntil,
      now,
      'SAML assertion has already been used.'
    )
    if (inResponseTo) {
      await this.consumeRequestId(inResponseTo, now)
    }

    const attributes = this.extractSamlAttributes(assertion)

    let email = attributes[config.sso_attr_email || 'email'] || ''
    if (!email) {
      const subject = this.childElements(assertion, SAML_ASSERTION_NS, 'Subject')[0]
      const nameId = subject
        ? (this.childElements(subject, SAML_ASSERTION_NS, 'NameID')[0]?.textContent || '').trim()
        : ''
      if (EMAIL.test(nameId)) email = nameId
    }

    return this.identity(
      email,
      attributes[config.sso_attr_name || 'name'] || '',
      attributes[config.sso_attr_role || 'role'] || ''
    )
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
   * Verifies the signature on the assertion itself against the IdP key and
   * returns the assertion parsed from the signed XML. A signed Response
   * around an unsigned assertion is refused: the assertion is what names the
   * user, so it must carry the IdP's signature.
   */
  private verifiedSamlAssertion(xml: string, root: Element, idpKey: KeyObject): Element {
    const assertion =
      root.getElementsByTagNameNS(SAML_ASSERTION_NS, 'Assertion')[0] ??
      (this.isElement(root, SAML_ASSERTION_NS, 'Assertion') ? root : undefined)
    if (!assertion) {
      throw new SsoValidationError('SAML response must contain exactly one assertion.')
    }

    const signatures = this.childElements(assertion, XMLDSIG_NS, 'Signature')
    if (signatures.length === 0) {
      throw new SsoValidationError('SAML assertion is not signed.')
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
  // Single-use message IDs (issued requests, used assertions, JWT jti)
  // -----------------------------------------------------------------

  /**
   * Issues an ID for an AuthnRequest and remembers it, server-side, for
   * `ttlSeconds` (ten minutes by default): the IdP's cross-site POST to the
   * ACS carries no SameSite=Lax session cookie. The response must name it in
   * InResponseTo, and it can be answered once.
   */
  async createSamlRequestId(ttlSeconds: number = DEFAULT_REQUEST_TTL): Promise<string> {
    const id = `_${randomBytes(20).toString('hex')}`
    const now = Math.floor(Date.now() / 1000)
    await this.pruneMessageIds(now)
    const db = await escalatedDb()
    await db.table(SSO_IDS_TABLE).insert({
      kind: 'request',
      message_id: id,
      expires_at: now + Math.max(1, Math.floor(ttlSeconds)),
    })
    return id
  }

  private async pruneMessageIds(now: number): Promise<void> {
    const db = await escalatedDb()
    await db.from(SSO_IDS_TABLE).where('expires_at', '<', now).delete()
  }

  /** Removes the issued request `id`; refuses one we never issued, already answered, or expired. */
  private async consumeRequestId(id: string, now: number): Promise<void> {
    const db = await escalatedDb()
    const deleted =
      id.length > MAX_MESSAGE_ID_LENGTH
        ? 0
        : await db
            .from(SSO_IDS_TABLE)
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

  /**
   * Records `id` of `kind` as used until `until`; refuses one already used.
   * The unique key on (kind, message_id) makes the check atomic.
   */
  private async claimMessageId(
    kind: 'assertion' | 'jwt',
    id: string,
    until: number,
    now: number,
    usedMessage: string
  ): Promise<void> {
    if (id.length > MAX_MESSAGE_ID_LENGTH) {
      throw new SsoValidationError(
        `${kind === 'jwt' ? 'JWT jti' : 'SAML assertion ID'} is too long.`
      )
    }
    await this.pruneMessageIds(now)
    const db = await escalatedDb()
    try {
      await db.table(SSO_IDS_TABLE).insert({ kind, message_id: id, expires_at: until })
    } catch (error) {
      const existing = await db
        .from(SSO_IDS_TABLE)
        .where('kind', kind)
        .where('message_id', id)
        .first()
      if (existing) {
        throw new SsoValidationError(usedMessage)
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
  // OAuth 2 / OIDC (openid-client)
  // -----------------------------------------------------------------

  /**
   * The openid-client configuration for the configured authorization server.
   * Its issuer is `sso_entity_id` when set (OIDC providers check an ID
   * token's `iss` against it), else the authorize URL's origin.
   */
  async oauthConfiguration(): Promise<{ client: oauth.Configuration; settings: SsoSettings }> {
    const settings = await this.getConfig()
    const authorize = (settings.sso_oauth_authorize_url || '').trim()
    const token = (settings.sso_oauth_token_url || '').trim()
    const userinfo = (settings.sso_oauth_userinfo_url || '').trim()
    const clientId = (settings.sso_oauth_client_id || '').trim()
    if (!authorize || !token || !userinfo || !clientId) {
      throw new SsoValidationError(
        'OAuth sign-in needs the authorize, token and userinfo URLs and a client ID.'
      )
    }

    let issuer: string
    try {
      issuer = (settings.sso_entity_id || '').trim() || new URL(authorize).origin
    } catch {
      throw new SsoValidationError('OAuth authorize URL is not a valid URL.')
    }

    const secret = settings.sso_oauth_client_secret || ''
    const client = new oauth.Configuration(
      {
        issuer,
        authorization_endpoint: authorize,
        token_endpoint: token,
        userinfo_endpoint: userinfo,
      },
      clientId,
      secret ? { client_secret: secret } : undefined,
      secret ? oauth.ClientSecretPost(secret) : oauth.None()
    )
    const customFetch = ssoConfig().fetch
    if (customFetch) {
      client[oauth.customFetch] = customFetch as any
    }
    return { client, settings }
  }

  /**
   * Starts the authorization-code flow: a fresh single-use `state` and PKCE
   * verifier (S256) for the caller to keep in the session, and the URL to
   * send the user to.
   */
  async oauthStart(): Promise<{ url: string; state: string; verifier: string }> {
    const { client, settings } = await this.oauthConfiguration()
    const verifier = oauth.randomPKCECodeVerifier()
    const state = oauth.randomState()
    const scope = (settings.sso_oauth_scopes || '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .join(' ')
    const url = oauth.buildAuthorizationUrl(client, {
      redirect_uri: ssoOauthRedirectUrl(),
      ...(scope ? { scope } : {}),
      code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
      state,
    })
    return { url: url.toString(), state, verifier }
  }

  /**
   * Finishes the flow: checks `state`, exchanges the code with the PKCE
   * verifier server to server, and reads the profile from the userinfo URL
   * with the access token.
   */
  async oauthIdentity(
    query: Record<string, unknown>,
    expectedState: string,
    verifier: string
  ): Promise<SsoIdentity> {
    if (query.error) {
      throw new SsoValidationError(`OAuth refused: the provider returned ${String(query.error)}.`)
    }
    if (!expectedState || typeof query.state !== 'string' || query.state !== expectedState) {
      throw new SsoValidationError('OAuth refused: missing or mismatched state.')
    }
    if (typeof query.code !== 'string' || query.code === '' || !verifier) {
      throw new SsoValidationError('OAuth refused: no authorization code or PKCE verifier.')
    }

    const { client, settings } = await this.oauthConfiguration()
    const callback = new URL(ssoOauthRedirectUrl())
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string') callback.searchParams.set(key, value)
    }

    let profile: Record<string, unknown>
    try {
      const tokens = await oauth.authorizationCodeGrant(client, callback, {
        pkceCodeVerifier: verifier,
        expectedState,
      })
      const response = await oauth.fetchProtectedResource(
        client,
        tokens.access_token,
        new URL(settings.sso_oauth_userinfo_url),
        'GET'
      )
      if (!response.ok) {
        throw new Error(`userinfo answered ${response.status}`)
      }
      profile = (await response.json()) as Record<string, unknown>
    } catch (error) {
      if (error instanceof SsoValidationError) throw error
      throw new SsoValidationError(`OAuth refused: ${(error as Error).message}`)
    }

    if (!profile || typeof profile !== 'object') {
      throw new SsoValidationError('OAuth refused: the userinfo response is not an object.')
    }
    if ([false, 'false', 0, '0'].includes(profile.email_verified as any)) {
      throw new SsoValidationError('OAuth refused: the provider says the email is not verified.')
    }

    const claim = (name: string, fallback = '') =>
      String(profile[name] ?? (fallback ? profile[fallback] : '') ?? '').trim()
    return this.identity(
      claim(settings.sso_attr_email || 'email', 'email'),
      claim(settings.sso_attr_name || 'name', 'name'),
      claim(settings.sso_attr_role || 'role')
    )
  }

  // -----------------------------------------------------------------
  // JWT (jose)
  // -----------------------------------------------------------------

  /**
   * Validates a JWT handed back by the identity provider. The algorithm is
   * pinned to `sso_jwt_algorithm` (HS* with `sso_jwt_secret`, RS* with the
   * public key or certificate in the same field), so `alg: none` and
   * algorithm switching are refused. `exp`, `aud` (`sso.jwtAudience`, default
   * the base URL) and `jti` are required, `nbf`/`iat` are honoured with
   * `sso.clockSkew`, and a `jti` works once.
   */
  async validateJwtToken(token: string): Promise<SsoIdentity> {
    const config = await this.getConfig()
    const algorithm = (config.sso_jwt_algorithm || 'HS256').trim()
    const secret = config.sso_jwt_secret || ''

    if (!(JWT_ALGORITHMS as readonly string[]).includes(algorithm)) {
      throw new SsoValidationError(`JWT refused: unsupported algorithm ${algorithm}.`)
    }
    if (!secret) {
      throw new SsoValidationError('JWT refused: no secret or public key is configured.')
    }

    const skew = ssoClockSkew()
    let payload: JWTPayload
    try {
      const key = algorithm.startsWith('HS')
        ? new TextEncoder().encode(secret)
        : secret.includes('BEGIN CERTIFICATE')
          ? await importX509(secret.trim(), algorithm)
          : await importSPKI(secret.trim(), algorithm)
      const result = await jwtVerify(String(token || ''), key, {
        algorithms: [algorithm],
        audience: ssoJwtAudience(),
        clockTolerance: skew,
        requiredClaims: ['exp', 'aud', 'jti'],
      })
      payload = result.payload
    } catch (error) {
      throw new SsoValidationError(`JWT refused: ${(error as Error).message}`)
    }

    const jti = typeof payload.jti === 'string' ? payload.jti : ''
    if (!jti) {
      throw new SsoValidationError('JWT refused: no jti claim.')
    }
    const now = Math.floor(Date.now() / 1000)
    await this.claimMessageId(
      'jwt',
      jti,
      Number(payload.exp) + skew,
      now,
      'JWT refused: this jti was already used.'
    )

    const claim = (name: string, fallback = '') =>
      String(
        (payload as Record<string, unknown>)[name] ??
          (fallback ? (payload as Record<string, unknown>)[fallback] : '') ??
          ''
      ).trim()
    return this.identity(
      claim(config.sso_attr_email || 'email', 'email'),
      claim(config.sso_attr_name || 'name', 'name'),
      claim(config.sso_attr_role || 'role')
    )
  }

  protected identity(email: string, name: string, role: string): SsoIdentity {
    if (!EMAIL.test(email)) {
      throw new SsoValidationError('SSO refused: no valid email in the identity.')
    }
    return { email, name, role }
  }
}
