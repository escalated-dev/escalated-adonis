import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { getConfig } from '../helpers/config.js'
import { twoFactorEnabled } from '../support/access_features.js'
import { confirmedEnrolment, isStaff, twoFactorRequired } from '../support/two_factor.js'
import TwoFactorSession from '../support/two_factor_session.js'

/**
 * While two-factor is switched on (`access.twoFactor`, ESCALATED_TWO_FACTOR):
 *
 * - a user with a confirmed enrolment who has not passed the challenge in this
 *   session is sent to `{prefix}/two-factor/challenge` (JSON requests: 403
 *   with `two_factor_required: true`);
 * - when two-factor is required, a staff user without an enrolment is sent to
 *   enrol and can reach nothing but the enrolment screen.
 *
 * Does nothing while the switch is off. Runs after the admin / agent gate on
 * every admin and agent route; the token API is not session-based and is not
 * challenged (ADR 2026-10-29-configurable-access-features).
 */
export default class RequireTwoFactor {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth?.user
    if (!twoFactorEnabled() || !user || !ctx.session) {
      return next()
    }

    const prefix = getConfig().routes?.prefix ?? 'support'

    if (await confirmedEnrolment(user)) {
      if (TwoFactorSession.passed(ctx.session, user)) return next()
      return this.deny(
        ctx,
        `/${prefix}/two-factor/challenge`,
        'Two-factor authentication is required.'
      )
    }

    if (
      (await twoFactorRequired()) &&
      (await isStaff(user)) &&
      !String(ctx.route?.name ?? '').startsWith('escalated.admin.two-factor.')
    ) {
      return this.deny(
        ctx,
        `/${prefix}/admin/settings/two-factor`,
        'Set up two-factor authentication to continue.'
      )
    }

    return next()
  }

  protected deny(ctx: HttpContext, path: string, message: string) {
    if (ctx.request.accepts(['html', 'json']) === 'json') {
      return ctx.response.forbidden({ message, two_factor_required: true })
    }

    if (ctx.request.method() === 'GET') {
      TwoFactorSession.setIntended(ctx.session, ctx.request.url(true))
    }

    return ctx.response.redirect().toPath(path)
  }
}
