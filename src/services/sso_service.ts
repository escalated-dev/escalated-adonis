import { createHmac } from 'node:crypto'
import { DOMParser } from '@xmldom/xmldom'
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

  async validateSamlAssertion(samlResponse: string): Promise<SsoUserResult> {
    const config = await this.getConfig()

    let xml: string
    try {
      xml = Buffer.from(samlResponse, 'base64').toString('utf-8')
    } catch {
      throw new SsoValidationError('Invalid SAML response: base64 decode failed.')
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    if (!doc || !doc.documentElement) {
      throw new SsoValidationError('Invalid SAML response: malformed XML.')
    }

    // Check issuer
    const entityId = (config.sso_entity_id || '').trim()
    if (entityId) {
      const issuerEls = doc.getElementsByTagNameNS(
        'urn:oasis:names:tc:SAML:2.0:assertion',
        'Issuer'
      )
      if (issuerEls.length === 0) {
        throw new SsoValidationError('SAML assertion missing Issuer element.')
      }
      const issuer = (issuerEls[0].textContent || '').trim()
      if (issuer !== entityId) {
        throw new SsoValidationError(
          `SAML Issuer mismatch: expected '${entityId}', got '${issuer}'.`
        )
      }
    }

    // Validate conditions
    const conditionsEls = doc.getElementsByTagNameNS(
      'urn:oasis:names:tc:SAML:2.0:assertion',
      'Conditions'
    )
    if (conditionsEls.length > 0) {
      this.validateSamlConditions(conditionsEls[0])
    }

    // Extract attributes
    const attributes = this.extractSamlAttributes(doc)

    let email = attributes[config.sso_attr_email || 'email']
    if (!email) {
      const nameIdEls = doc.getElementsByTagNameNS(
        'urn:oasis:names:tc:SAML:2.0:assertion',
        'NameID'
      )
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

  private extractSamlAttributes(doc: Document): Record<string, string> {
    const attributes: Record<string, string> = {}
    const attrEls = doc.getElementsByTagNameNS(
      'urn:oasis:names:tc:SAML:2.0:assertion',
      'Attribute'
    )
    for (let i = 0; i < attrEls.length; i++) {
      const name = attrEls[i].getAttribute('Name')
      if (!name) continue
      const valueEls = attrEls[i].getElementsByTagNameNS(
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
      (payload[attrEmail] as string) ||
      (payload.email as string) ||
      (payload.sub as string)
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
      const expected = createHmac(hmacAlgos[algorithm], secret)
        .update(signingInput)
        .digest()
      return expected.length === signature.length &&
        require('node:crypto').timingSafeEqual(expected, signature)
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
