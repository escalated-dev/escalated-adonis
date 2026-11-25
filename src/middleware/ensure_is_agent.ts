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
 * Middleware to ensure the current user is an Escalated support agent.
 */
export default class EnsureIsAgent {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth?.user

    if (!user) {
      return ctx.response.forbidden({ error: t('middleware.not_agent') })
    }

    // Also allow admins to access agent routes
    const isAgent = await passesStaffGate('isAgent', user)
    const isAdmin = isAgent || (await passesStaffGate('isAdmin', user))

    if (!isAgent && !isAdmin) {
      // With neither gate configured nobody is staff: say what is missing.
      const missing = missingStaffGates()
      if (missing.length === 2) {
        const message = missingStaffGatesMessage(missing)
        ctx.logger?.warn(message)
        return ctx.response.forbidden({ error: message })
      }
      return ctx.response.forbidden({ error: t('middleware.not_agent') })
    }

    // Staff actions need the user's id: fail here, naming the contract,
    // rather than on the first write.
    assertEscalatedAuthUser(user)

    return next()
  }
}
