import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import User from './user.js'

/**
 * Plays the host application's `auth` middleware in integration tests: the
 * signed-in user is whoever the `x-test-user-id` header names.
 */
export default class AuthMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = await User.find(ctx.request.header('x-test-user-id') ?? '')
    if (!user) {
      return ctx.response.unauthorized({ error: 'Sign in first.' })
    }

    ;(ctx as any).auth = { user, isAuthenticated: true }
    return next()
  }
}
