import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from '../user.js'

/**
 * Plays a host admin panel's middleware in the embedded-admin specs: it signs
 * the user in (as the host's `auth` does), lets the host's own staff through
 * (anyone who is not a customer, whatever Escalated thinks of them) and
 * marks every response it handles with `x-host-panel`.
 */
export default class HostPanelMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    ctx.response.header('x-host-panel', 'ran')

    const user = await User.find(
      ctx.request.header('x-test-user-id') ?? ctx.session?.get('test_auth_user_id') ?? ''
    )
    if (!user) {
      return ctx.response.unauthorized({ error: 'Host panel: sign in first.' })
    }
    if (user.role === 'customer') {
      return ctx.response.forbidden({ error: 'Host panel: staff only.' })
    }

    ;(ctx as any).auth = { ...(ctx as any).auth, user, isAuthenticated: true }
    return next()
  }
}
