import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { getConfig } from '../helpers/config.js'
import SsoService, { SsoValidationError, type SsoProvider } from '../services/sso_service.js'
import SsoUserResolver from '../services/sso_user_resolver.js'
import TwoFactorSession from '../support/two_factor_session.js'
import {
  isLocalPath,
  ssoConfig,
  ssoJwtCallbackUrl,
  ssoRoutePrefix,
  type SsoIdentity,
} from '../support/sso.js'

const OAUTH_STATE = 'escalated.sso.oauth_state'
const OAUTH_PKCE = 'escalated.sso.oauth_pkce'
const INTENDED = 'escalated.sso.intended'

/**
 * Sign-in through the SSO provider chosen in Admin > Settings > SSO
 * (ADR 2026-10-29-configurable-access-features). Every route answers 404
 * while `access.sso` is off (route middleware), and for a provider other than
 * the chosen one.
 *
 * GET      {prefix}/sso/login          escalated.sso.login
 * GET      {prefix}/sso/saml/metadata  escalated.sso.saml.metadata
 * POST     {prefix}/sso/saml/acs       escalated.sso.saml.acs
 * GET      {prefix}/sso/oauth/callback escalated.sso.oauth.callback
 * GET|POST {prefix}/sso/jwt/callback   escalated.sso.jwt.callback
 *
 * Signing in through SSO does not pass the two-factor challenge: the
 * session's pass is cleared, so RequireTwoFactor still asks for the code.
 */
export default class SsoController {
  protected sso = new SsoService()
  protected users = new SsoUserResolver()

  async login(ctx: HttpContext) {
    const provider = await this.sso.getProvider()
    if (provider === 'none') return this.notFound(ctx)

    const intended = ctx.request.input('intended')
    try {
      switch (provider) {
        case 'saml':
          return ctx.response
            .redirect()
            .toPath(await this.sso.samlLoginUrl(isLocalPath(intended) ? intended : undefined))
        case 'oauth': {
          const start = await this.sso.oauthStart()
          ctx.session.put(OAUTH_STATE, start.state)
          ctx.session.put(OAUTH_PKCE, start.verifier)
          this.rememberIntended(ctx, intended)
          return ctx.response.redirect().toPath(start.url)
        }
        case 'jwt':
          this.rememberIntended(ctx, intended)
          return ctx.response.redirect().toPath(await this.jwtLoginUrl())
      }
    } catch (error) {
      return this.refuse(ctx, error)
    }
  }

  async metadata(ctx: HttpContext) {
    if (!(await this.requireProvider(ctx, 'saml'))) return
    ctx.response.header('Content-Type', 'application/samlmetadata+xml; charset=utf-8')
    return ctx.response.send(this.sso.samlMetadata())
  }

  async samlAcs(ctx: HttpContext) {
    if (!(await this.requireProvider(ctx, 'saml'))) return
    const relayState = ctx.request.input('RelayState')
    return this.signIn(
      ctx,
      () => this.sso.validateSamlAssertion(String(ctx.request.input('SAMLResponse') ?? '')),
      isLocalPath(relayState) ? relayState : undefined
    )
  }

  async oauthCallback(ctx: HttpContext) {
    if (!(await this.requireProvider(ctx, 'oauth'))) return
    // Single use: pulled before anything is checked.
    const state = String(ctx.session.pull(OAUTH_STATE, '') ?? '')
    const verifier = String(ctx.session.pull(OAUTH_PKCE, '') ?? '')
    return this.signIn(ctx, () => this.sso.oauthIdentity(ctx.request.qs(), state, verifier))
  }

  async jwtCallback(ctx: HttpContext) {
    if (!(await this.requireProvider(ctx, 'jwt'))) return
    return this.signIn(ctx, () => this.sso.validateJwtToken(String(ctx.request.input('jwt') ?? '')))
  }

  // ---------------------------------------------------------------------------

  protected async jwtLoginUrl(): Promise<string> {
    const config = await this.sso.getConfig()
    const target = (config.sso_login_url || config.sso_url || '').trim()
    if (!/^https?:\/\//i.test(target)) {
      throw new SsoValidationError('JWT sign-in has no login URL configured.')
    }
    const url = new URL(target)
    url.searchParams.set('return_to', ssoJwtCallbackUrl())
    return url.toString()
  }

  protected async signIn(
    ctx: HttpContext,
    identify: () => Promise<SsoIdentity>,
    relayState?: string
  ) {
    let user: any
    try {
      user = await this.users.resolve(await identify())
    } catch (error) {
      return this.refuse(ctx, error)
    }

    const login = ssoConfig().login
    if (login) {
      await login(ctx, user)
    } else {
      const auth = (ctx as any).auth
      if (!auth || typeof auth.use !== 'function') {
        throw new Error(
          'Escalated SSO: ctx.auth.use() is not available. Register @adonisjs/auth or set sso.login.'
        )
      }
      await auth.use(ssoConfig().guard).login(user)
    }

    // A new sign-in: the two-factor challenge has not been passed for it.
    TwoFactorSession.forget(ctx.session)
    const intended = ctx.session.pull(INTENDED, null)
    ctx.session.regenerate()

    logger.info(
      { userId: user?.id, provider: await this.sso.getProvider() },
      'Escalated SSO: signed in'
    )

    const target = relayState ?? (isLocalPath(intended) ? intended : await this.home(user))
    return ctx.response.redirect().toPath(target)
  }

  protected async home(user: any): Promise<string> {
    const configured = ssoConfig().redirectTo
    if (configured) return configured

    const prefix = ssoRoutePrefix()
    const authorization = getConfig().authorization
    if (authorization?.isAgent && (await authorization.isAgent(user))) {
      return `/${prefix}/agent/tickets`
    }
    if (authorization?.isAdmin && (await authorization.isAdmin(user))) {
      return `/${prefix}/admin/reports`
    }
    return `/${prefix}`
  }

  protected rememberIntended(ctx: HttpContext, intended: unknown) {
    if (isLocalPath(intended)) ctx.session.put(INTENDED, intended)
  }

  /** Every refusal looks the same to the user; the reason goes to the log. */
  protected refuse(ctx: HttpContext, error: unknown) {
    if (!(error instanceof SsoValidationError)) throw error
    logger.warn({ ip: ctx.request.ip() }, `Escalated SSO: ${error.message}`)
    return ctx.response.status(403).send('Single sign-on failed. Contact your administrator.')
  }

  protected async requireProvider(ctx: HttpContext, provider: SsoProvider): Promise<boolean> {
    if ((await this.sso.getProvider()) === provider) return true
    this.notFound(ctx)
    return false
  }

  protected notFound(ctx: HttpContext) {
    return ctx.response.notFound({ error: 'Not Found' })
  }
}
