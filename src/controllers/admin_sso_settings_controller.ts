import type { HttpContext } from '@adonisjs/core/http'
import SsoService, { JWT_ALGORITHMS, type SsoSettings } from '../services/sso_service.js'
import AuditService from '../services/audit_service.js'
import { AUDIT_ACTIONS } from '../support/audit_events.js'
import { getRenderer } from '../rendering/renderer.js'
import { isMaskedSecret, maskSecret } from '../support/secret_mask.js'

/** Stored secrets the page only sees as a mask. */
const SECRET_KEYS = ['sso_jwt_secret', 'sso_oauth_client_secret'] as const

const URL_KEYS = [
  'sso_url',
  'sso_login_url',
  'sso_logout_url',
  'sso_metadata_url',
  'sso_oauth_authorize_url',
  'sso_oauth_token_url',
  'sso_oauth_userinfo_url',
] as const

const MAX_LENGTH: Record<string, number> = {
  sso_entity_id: 500,
  sso_certificate: 10000,
  sso_attr_email: 100,
  sso_attr_name: 100,
  sso_attr_role: 100,
  sso_jwt_secret: 10000,
  sso_oauth_client_id: 255,
  sso_oauth_client_secret: 500,
  sso_oauth_scopes: 255,
}

const REQUIRED_FOR: Record<string, string[]> = {
  saml: ['sso_entity_id', 'sso_login_url'],
  jwt: ['sso_url', 'sso_jwt_secret'],
  oauth: [
    'sso_oauth_authorize_url',
    'sso_oauth_token_url',
    'sso_oauth_userinfo_url',
    'sso_oauth_client_id',
  ],
}

/**
 * Admin > Settings > SSO: the provider and its fields, plus the endpoints the
 * admin gives the identity provider. 404 while `access.sso` is off
 * (ADR 2026-10-29-configurable-access-features). Secrets are never sent to
 * the page, only a mask; posting the mask back keeps the stored value.
 */
export default class AdminSsoSettingsController {
  protected sso = new SsoService()

  async index(ctx: HttpContext) {
    const settings: Record<string, string> = { ...(await this.sso.getConfig()) }
    for (const key of SECRET_KEYS) {
      settings[key] = maskSecret(settings[key])
    }

    return getRenderer().render(ctx, 'Escalated/Admin/Settings/SsoSettings', {
      settings,
      endpoints: this.sso.endpoints(),
    })
  }

  async update(ctx: HttpContext) {
    const { request, response, session } = ctx
    const input = request.only([
      'sso_provider',
      'sso_entity_id',
      'sso_certificate',
      'sso_attr_email',
      'sso_attr_name',
      'sso_attr_role',
      'sso_jwt_secret',
      'sso_jwt_algorithm',
      'sso_oauth_client_id',
      'sso_oauth_client_secret',
      'sso_oauth_scopes',
      ...URL_KEYS,
    ]) as Record<string, unknown>

    const data: Record<string, string> = {}
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue
      data[key] = value === null ? '' : String(value).trim()
    }

    // The page posts the mask back for a secret the admin did not change.
    for (const key of SECRET_KEYS) {
      if (isMaskedSecret(data[key])) delete data[key]
    }

    const errors: Record<string, string> = {}
    if (!['none', 'saml', 'oauth', 'jwt'].includes(data.sso_provider ?? '')) {
      errors.sso_provider = 'The provider must be none, saml, oauth or jwt.'
    }
    for (const key of URL_KEYS) {
      if (data[key] && !/^https?:\/\/[^\s]+$/i.test(data[key])) {
        errors[key] = 'This must be an http(s) URL.'
      } else if (data[key] && data[key].length > 500) {
        errors[key] = 'This is too long.'
      }
    }
    for (const [key, max] of Object.entries(MAX_LENGTH)) {
      if (data[key] && data[key].length > max) errors[key] = 'This is too long.'
    }
    if (
      data.sso_jwt_algorithm &&
      !(JWT_ALGORITHMS as readonly string[]).includes(data.sso_jwt_algorithm)
    ) {
      errors.sso_jwt_algorithm = `The algorithm must be one of ${JWT_ALGORITHMS.join(', ')}.`
    }

    const stored = await this.sso.getConfig()
    for (const key of REQUIRED_FOR[data.sso_provider ?? ''] ?? []) {
      const value =
        key in data
          ? data[key]
          : (SECRET_KEYS as readonly string[]).includes(key)
            ? stored[key as keyof SsoSettings]
            : ''
      if (!value && !errors[key]) errors[key] = 'This field is required for this provider.'
    }

    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    await this.sso.saveConfig(data as Partial<SsoSettings>)

    const changed: Record<string, string> = { ...data }
    for (const key of SECRET_KEYS) {
      if (key in changed) changed[key] = '[redacted]'
    }
    await AuditService.fromContext(ctx as any, AUDIT_ACTIONS.SETTINGS_UPDATED, {
      auditableType: 'settings',
      newValues: changed,
    })

    session.flash('success', 'SSO settings updated.')
    return response.redirect().back()
  }
}
