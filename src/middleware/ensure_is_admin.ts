import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { t } from '../support/i18n.js'
import { assertEscalatedAuthUser } from '../support/auth_user.js'
import {
  missingStaffGates,
  missingStaffGatesMessage,
  passesStaffGate,
} from '../support/staff_gates.js'

/**
 * Middleware to ensure the current user is an Escalated administrator.
 */
export default class EnsureIsAdmin {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth?.user

    if (!user) {
      return ctx.response.forbidden({ error: t('middleware.not_admin') })
    }

    if (!(await passesStaffGate('isAdmin', user))) {
      // Without an isAdmin gate nobody is an admin: say what is missing.
      const missing = missingStaffGates()
      if (missing.includes('isAdmin')) {
        const message = missingStaffGatesMessage(['isAdmin'])
        ctx.logger?.warn(message)
        return ctx.response.forbidden({ error: message })
      }
      return ctx.response.forbidden({ error: t('middleware.not_admin') })
    }

    // Staff actions need the user's id: fail here, naming the contract,
    // rather than on the first write.
    assertEscalatedAuthUser(user)

    return next()
  }
}
