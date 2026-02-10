import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Middleware to ensure the current user is an Escalated support agent.
 */
export default class EnsureIsAgent {
  async handle(ctx: HttpContext, next: NextFn) {
    const config = (globalThis as any).__escalated_config
    const user = ctx.auth?.user

    if (!user) {
      return ctx.response.forbidden({ error: 'You are not authorized as a support agent.' })
    }

    const isAgent = config?.authorization?.isAgent
      ? await config.authorization.isAgent(user)
      : false

    // Also allow admins to access agent routes
    const isAdmin = config?.authorization?.isAdmin
      ? await config.authorization.isAdmin(user)
      : false

    if (!isAgent && !isAdmin) {
      return ctx.response.forbidden({ error: 'You are not authorized as a support agent.' })
    }

    return next()
  }
}
