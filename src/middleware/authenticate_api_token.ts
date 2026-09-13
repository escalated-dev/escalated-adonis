import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiToken from '../models/api_token.js'
import { getConfig } from '../helpers/config.js'

/**
 * The abilities the admin screen issues API tokens with.
 *
 * - `agent`: the agent API. The token's owner must be an agent or an admin.
 * - `admin`: admin-only API actions, such as deleting a ticket. The token's
 *   owner must be an admin.
 *
 * A token issued with `*` holds every ability.
 */
export type ApiAbility = 'agent' | 'admin'

export interface AuthenticateApiTokenOptions {
  /** The ability the route requires. Defaults to `agent`. */
  ability?: ApiAbility
}

/**
 * Middleware to authenticate API requests using Bearer token authentication.
 *
 * Extracts the token from the Authorization header, validates it against
 * the database (SHA-256 hashed), checks expiration, the ability the route
 * requires and the token owner's current role, then sets the token owner as
 * the authenticated user on the HTTP context.
 */
export default class AuthenticateApiToken {
  async handle(ctx: HttpContext, next: NextFn, options: AuthenticateApiTokenOptions = {}) {
    // Default to the narrower check, so a route that forgets to name an ability
    // is still limited to agents.
    const ability = options.ability ?? 'agent'

    const plainToken = this.extractToken(ctx)

    if (!plainToken) {
      return ctx.response.unauthorized({ message: 'Unauthenticated.' })
    }

    const apiToken = await ApiToken.findByPlainText(plainToken)

    if (!apiToken) {
      return ctx.response.unauthorized({ message: 'Invalid token.' })
    }

    if (apiToken.isExpired()) {
      return ctx.response.unauthorized({ message: 'Token has expired.' })
    }

    if (!apiToken.hasAbility(ability)) {
      return ctx.response.forbidden({ message: 'Insufficient permissions.' })
    }

    // Load the token owner
    const user = await apiToken.loadTokenable()

    if (!user) {
      return ctx.response.unauthorized({ message: 'Token owner not found.' })
    }

    // A token's abilities say what it may be used for; the owner's role says
    // whether they may still do it. A token outlives its owner's demotion.
    const authorization = getConfig().authorization
    const isAdmin = authorization?.isAdmin ? await authorization.isAdmin(user) : false
    const isAgent = authorization?.isAgent ? await authorization.isAgent(user) : false

    if (!isAgent && !isAdmin) {
      return ctx.response.forbidden({ message: 'User no longer has agent access.' })
    }

    if (ability === 'admin' && !isAdmin) {
      return ctx.response.forbidden({ message: 'Insufficient permissions.' })
    }

    // Update last usage
    const { DateTime } = await import('luxon')
    apiToken.lastUsedAt = DateTime.now()
    apiToken.lastUsedIp = ctx.request.ip() ?? null
    await apiToken.save()

    // Set the authenticated user and token on the context
    ;(ctx as any).auth = { user, isAuthenticated: true }
    ;(ctx as any).apiToken = apiToken

    return next()
  }

  /**
   * Extract Bearer token from the Authorization header.
   */
  protected extractToken(ctx: HttpContext): string | null {
    const header = ctx.request.header('Authorization') ?? ''

    if (header.startsWith('Bearer ')) {
      return header.substring(7)
    }

    return null
  }
}
