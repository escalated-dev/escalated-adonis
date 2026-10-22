import { createHmac, createPublicKey, timingSafeEqual, type KeyObject } from 'node:crypto'
import { DOMParser, type Element } from '@xmldom/xmldom'
import { SignedXml } from 'xml-crypto'
import EscalatedSetting from '../models/escalated_setting.js'

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
]

const SAML_ASSERTION_NS = 'urn:oasis:names:tc:SAML:2.0:assertion'
const SAML_PROTOCOL_NS = 'urn:oasis:names:tc:SAML:2.0:protocol'
const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#'

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
   */
  async validateSamlAssertion(samlResponse: string): Promise<SsoUserResult> {
    const config = await this.getConfig()
    const idpKey = this.samlIdpKey(config.sso_certificate)

    const xml = Buffer.from(samlResponse || '', 'base64').toString('utf-8')
    const doc = this.parseXml(xml)

    if (doc.getElementsByTagNameNS(SAML_ASSERTION_NS, 'EncryptedAssertion').length > 0) {
      throw new SsoValidationError('Encrypted SAML assertions are not supported.')
    }
    if (doc.getElementsByTagNameNS(SAML_ASSERTION_NS, 'Assertion').length !== 1) {
      throw new SsoValidationError('SAML response must contain exactly one assertion.')
    }

    const assertion = this.verifiedSamlAssertion(xml, doc.documentElement as Element, idpKey)

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

    // Validate conditions
    const conditionsEls = assertion.getElementsByTagNameNS(SAML_ASSERTION_NS, 'Conditions')
    if (conditionsEls.length > 0) {
      this.validateSamlConditions(conditionsEls[0])
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

  private validateSamlConditions(conditionsEl: Element): void {
    const now = Math.floor(Date.now() / 1000)
    const skew = 120

    const notBefore = conditionsEl.getAttribute('NotBefore')
    if (notBefore) {
      const dt = Math.floor(new Date(notBefore).getTime() / 1000)
      if (dt > now + skew) {
        throw new SsoValidationError('SAML assertion is not yet valid.')
      }
    }

    const notOnOrAfter = conditionsEl.getAttribute('NotOnOrAfter')
    if (notOnOrAfter) {
      const dt = Math.floor(new Date(notOnOrAfter).getTime() / 1000)
      if (dt < now - skew) {
        throw new SsoValidationError('SAML assertion has expired.')
      }
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
