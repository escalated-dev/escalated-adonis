import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { t } from '../support/i18n.js'

/**
 * Middleware to ensure the current user is an Escalated administrator.
 */
export default class EnsureIsAdmin {
  async handle(ctx: HttpContext, next: NextFn) {
    const config = (globalThis as any).__escalated_config
    const user = ctx.auth?.user

    if (!user) {
      return ctx.response.forbidden({ error: t('middleware.not_admin') })
    }

    const isAdmin = config?.authorization?.isAdmin
      ? await config.authorization.isAdmin(user)
      : false

    if (!isAdmin) {
      return ctx.response.forbidden({ error: t('middleware.not_admin') })
    }

    return next()
  }
}
