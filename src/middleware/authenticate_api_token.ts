import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import ApiToken from '../models/api_token.js'

/**
 * Middleware to authenticate API requests using Bearer token authentication.
 *
 * Extracts the token from the Authorization header, validates it against
 * the database (SHA-256 hashed), checks expiration and abilities, then
 * sets the token owner as the authenticated user on the HTTP context.
 */
export default class AuthenticateApiToken {
  async handle(ctx: HttpContext, next: NextFn, guards?: string[]) {
    const ability = guards?.[0] ?? null

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

    if (ability && !apiToken.hasAbility(ability)) {
      return ctx.response.forbidden({ message: 'Insufficient permissions.' })
    }

    // Load the token owner
    const user = await apiToken.loadTokenable()

    if (!user) {
      return ctx.response.unauthorized({ message: 'Token owner not found.' })
    }

    // Update last usage
    apiToken.lastUsedAt = (await import('luxon')).DateTime.now()
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
