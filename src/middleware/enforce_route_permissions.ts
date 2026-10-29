import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { rolesPermissionsEnabled } from '../support/access_features.js'
import { requiredPermissions } from '../support/route_permissions.js'
import { userPermissions } from '../support/permissions.js'

/**
 * Requires the route's permission (src/support/route_permissions.ts) from the
 * user's roles while roles & permissions is switched on. Does nothing while
 * it is off.
 *
 * Runs after the admin/agent gate or the API token middleware, so the gates
 * still decide who reaches the area at all; this adds the permission on top.
 * API tokens act as their owner, whom the token middleware has signed in. A
 * route missing from the map is refused rather than let through.
 */
export default class EnforceRoutePermissions {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!rolesPermissionsEnabled()) {
      return next()
    }

    const user = (ctx as any).auth?.user as { id?: number | string } | undefined
    const name = ctx.route?.name

    if (!user || user.id === undefined || typeof name !== 'string') {
      return ctx.response.forbidden({ error: 'Unauthorized.' })
    }

    const required = requiredPermissions(name, (key) => ctx.request.input(key))

    if (required === null) {
      return ctx.response.forbidden({ error: 'This route has no permission mapping.' })
    }

    if (required.length > 0) {
      const granted = await userPermissions(user.id)
      for (const slug of required) {
        if (!granted.includes(slug)) {
          return ctx.response.forbidden({
            error: `You do not have the required permission: ${slug}`,
            permission: slug,
          })
        }
      }
    }

    return next()
  }
}
