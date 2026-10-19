import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { getConfig } from '../helpers/config.js'
import {
  crossOriginOf,
  widgetOriginAllowed,
  WIDGET_CSRF_SKIPPED,
  WIDGET_ORIGIN,
} from '../support/widget_origins.js'
import {
  corsResponseHeaders,
  isPreflight,
  mergeVary,
  preflightHeaders,
  WIDGET_CORS_DEFAULT_MAX_AGE,
} from '../support/widget_cors.js'

/**
 * CORS for the widget routes, first in their middleware so its headers reach
 * every answer, including 4xx and the guest rate limit's 429.
 *
 * Only origins in `widget.allowedOrigins` or the `widget_allowed_origins`
 * setting get CORS headers. Such a request is recorded on the context
 * (`escalatedWidgetOrigin`) and always runs as a guest: whoever is signed in
 * to the host in the same browser is never used from another site. Every
 * other request passes through untouched.
 */
export default class WidgetCors {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx
    const origin = crossOriginOf(request)
    const allowed = origin !== null && (await widgetOriginAllowed(origin))

    if (isPreflight(request.method(), request.header('access-control-request-method'))) {
      const maxAge = getConfig().widget?.preflightMaxAge ?? WIDGET_CORS_DEFAULT_MAX_AGE
      for (const [name, value] of Object.entries(
        preflightHeaders(allowed ? origin : null, maxAge)
      )) {
        response.header(name, value)
      }
      response.header('Vary', mergeVary(response.getHeader('Vary')))
      return response.noContent()
    }

    if (!allowed) {
      // The CSRF check let this through on a stale copy of the admin setting.
      if ((ctx as any)[WIDGET_CSRF_SKIPPED]) {
        return response.forbidden({ error: 'This site may not embed the widget.' })
      }
      return next()
    }

    ;(ctx as any)[WIDGET_ORIGIN] = origin
    ;(ctx as any).auth = guestAuth()

    // Set before the handler runs, so an exception's answer carries them too.
    const apply = () => {
      for (const [name, value] of Object.entries(corsResponseHeaders(origin))) {
        response.header(name, value)
      }
      response.header('Vary', mergeVary(response.getHeader('Vary')))
    }
    apply()
    try {
      return await next()
    } finally {
      apply()
    }
  }
}

/**
 * Stands in for `ctx.auth` on a request from an embedding site: nobody is
 * signed in, and asking for a user fails as for a guest.
 */
function guestAuth() {
  const unauthorized = () =>
    Object.assign(new Error('Unauthorized access'), {
      status: 401,
      code: 'E_UNAUTHORIZED_ACCESS',
    })

  const auth: Record<string, unknown> = {
    user: undefined,
    isAuthenticated: false,
    isLoggedIn: false,
    isGuest: true,
    authenticationAttempted: true,
    check: async () => false,
    authenticate: async () => {
      throw unauthorized()
    },
    authenticateUsing: async () => {
      throw unauthorized()
    },
    getUserOrFail: () => {
      throw unauthorized()
    },
    use: () => auth,
  }
  return auth
}
