import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { t } from '../support/i18n.js'
import { isStaff } from '../support/attachment_access.js'

/**
 * Agents and admins: for screens about the staff member's own account, such
 * as two-factor enrolment.
 */
export default class EnsureIsStaff {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!(await isStaff(ctx.auth?.user))) {
      return ctx.response.forbidden({ error: t('middleware.not_agent') })
    }
    return next()
  }
}
