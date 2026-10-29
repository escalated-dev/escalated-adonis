/*
|--------------------------------------------------------------------------
| Single sign-on options
|--------------------------------------------------------------------------
|
| ADR 2026-10-29-configurable-access-features. Used while `access.sso`
| (ESCALATED_SSO) is on. The provider and its fields are chosen at runtime in
| Admin > Settings > SSO (`sso_*` settings); these are the install-level rules
| around it, read from `sso` in config/escalated.ts, falling back to the
| ESCALATED_SSO_* environment variables. No stored setting changes them.
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import { getConfig } from '../helpers/config.js'

/** Default clock skew, in seconds. */
export const DEFAULT_SSO_CLOCK_SKEW = 120
/** The largest clock skew `sso.clockSkew` may set, in seconds. */
export const MAX_SSO_CLOCK_SKEW = 300

/** The identity an SSO provider asserted. */
export interface SsoIdentity {
  email: string
  name: string
  role: string
}

/** `sso` in config/escalated.ts. */
export interface SsoConfig {
  /**
   * The public base URL the SSO endpoints are built from (scheme, host and
   * any path prefix). Unset: `appUrl`, then APP_URL. Never taken from the
   * request's Host header.
   */
  baseUrl?: string
  /** SAML SP entity ID (the Audience). Unset: ESCALATED_SSO_SP_ENTITY_ID, then the metadata URL. */
  spEntityId?: string
  /** SAML ACS URL as the IdP posts to it. Unset: ESCALATED_SSO_ACS_URL, then `{baseUrl}/{prefix}/sso/saml/acs`. */
  acsUrl?: string
  /** Accept SAML responses that answer no request (IdP-initiated). Default false. */
  allowIdpInitiated?: boolean
  /** The `aud` a JWT must carry. Unset: ESCALATED_SSO_JWT_AUDIENCE, then the base URL. */
  jwtAudience?: string
  /** Seconds of clock skew on SAML and JWT validity windows. Default 120, at most 300. */
  clockSkew?: number
  /** Create a host user for an unknown email. Default false: unknown emails are refused. */
  createUsers?: boolean
  /** With roles & permissions on, replace the user's roles with the asserted role (by slug). Default false. */
  syncRoles?: boolean
  /** The `@adonisjs/auth` guard to sign in on. Unset: the default guard. */
  guard?: string
  /** Where to land after sign-in. Unset: the agent tickets, admin reports, or the customer portal. */
  redirectTo?: string
  /** Signs the user in. Unset: `ctx.auth.use(guard).login(user)`. */
  login?: (ctx: HttpContext, user: any) => Promise<void> | void
  /** Finds a host user by email (case-insensitive). Unset: the user model's `query()`. */
  findUserByEmail?: (email: string) => Promise<any> | any
  /** Creates a host user. Unset: the user model's `create()` with a random password. */
  createUser?: (identity: SsoIdentity) => Promise<any> | any
  /** The `fetch` used for the OAuth token and userinfo calls. Unset: the global one. */
  fetch?: typeof fetch
}

function envFlag(name: string): boolean | undefined {
  const value = process.env[name]
  if (typeof value !== 'string' || value.trim() === '') return undefined
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function envString(name: string): string | undefined {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

export function ssoConfig(): SsoConfig {
  return ((getConfig() as any).sso ?? {}) as SsoConfig
}

function flag(value: unknown, envName: string): boolean {
  if (value === undefined || value === null) return envFlag(envName) ?? false
  return value === true || value === 'true'
}

function text(value: unknown, envName: string): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  return envString(envName)
}

export function ssoRoutePrefix(): string {
  return String(getConfig().routes?.prefix ?? 'support').replace(/^\/+|\/+$/g, '')
}

/** The public base URL, without a trailing slash. */
export function ssoBaseUrl(): string {
  const configured =
    text(ssoConfig().baseUrl, 'ESCALATED_SSO_BASE_URL') ??
    (typeof (getConfig() as any).appUrl === 'string' && (getConfig() as any).appUrl !== ''
      ? (getConfig() as any).appUrl
      : undefined) ??
    envString('APP_URL') ??
    'http://localhost'
  return String(configured).replace(/\/+$/, '')
}

/** An absolute URL for `{prefix}/sso/{path}`. */
export function ssoUrl(path: string): string {
  const prefix = ssoRoutePrefix()
  return `${ssoBaseUrl()}/${prefix ? `${prefix}/` : ''}sso/${path}`
}

export function ssoSpEntityId(): string {
  return text(ssoConfig().spEntityId, 'ESCALATED_SSO_SP_ENTITY_ID') ?? ssoUrl('saml/metadata')
}

export function ssoAcsUrl(): string {
  return text(ssoConfig().acsUrl, 'ESCALATED_SSO_ACS_URL') ?? ssoUrl('saml/acs')
}

export function ssoOauthRedirectUrl(): string {
  return ssoUrl('oauth/callback')
}

export function ssoJwtCallbackUrl(): string {
  return ssoUrl('jwt/callback')
}

export function ssoJwtAudience(): string {
  return text(ssoConfig().jwtAudience, 'ESCALATED_SSO_JWT_AUDIENCE') ?? ssoBaseUrl()
}

export function ssoAllowIdpInitiated(): boolean {
  return flag(ssoConfig().allowIdpInitiated, 'ESCALATED_SSO_ALLOW_IDP_INITIATED')
}

export function ssoCreateUsers(): boolean {
  return flag(ssoConfig().createUsers, 'ESCALATED_SSO_CREATE_USERS')
}

export function ssoSyncRoles(): boolean {
  return flag(ssoConfig().syncRoles, 'ESCALATED_SSO_SYNC_ROLES')
}

/** Seconds of clock skew: 120 by default, never below 0 or above 300. */
export function ssoClockSkew(): number {
  const configured = ssoConfig().clockSkew ?? envString('ESCALATED_SSO_CLOCK_SKEW')
  const parsed = Number.parseInt(String(configured ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SSO_CLOCK_SKEW
  return Math.min(parsed, MAX_SSO_CLOCK_SKEW)
}

/** The URLs an admin gives the identity provider (the SSO settings page's `endpoints`). */
export function ssoEndpoints(): Record<string, string> {
  return {
    login: ssoUrl('login'),
    sp_entity_id: ssoSpEntityId(),
    metadata: ssoUrl('saml/metadata'),
    acs: ssoAcsUrl(),
    oauth_redirect: ssoOauthRedirectUrl(),
    jwt_callback: ssoJwtCallbackUrl(),
  }
}

/**
 * For `@adonisjs/shield`'s `csrf.exceptRoutes`: the SAML ACS and the JWT
 * callback receive cross-site POSTs from the identity provider, which carry
 * no CSRF token. The signed, single-use assertion or token is what
 * authenticates them.
 *
 *   csrf: { exceptRoutes: (ctx) => isSsoCsrfExempt(ctx) || isWidgetCsrfExempt(ctx) }
 */
export function isSsoCsrfExempt(ctx: { route?: { name?: string } }): boolean {
  const name = ctx.route?.name
  return name === 'escalated.sso.saml.acs' || name === 'escalated.sso.jwt.callback'
}

/** A path on this site: `/x`, never `//host` or `/\host`. */
export function isLocalPath(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.startsWith('/') &&
    !url.startsWith('//') &&
    !url.startsWith('/\\') &&
    url.length <= 2000
  )
}
