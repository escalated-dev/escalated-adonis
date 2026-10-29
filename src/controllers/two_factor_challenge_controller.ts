import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import { getConfig } from '../helpers/config.js'
import { getRenderer } from '../rendering/renderer.js'
import { requireAuthUser } from '../support/auth_user.js'
import { confirmedEnrolment, consumeCode, consumeRecoveryCode } from '../support/two_factor.js'
import TwoFactorSession from '../support/two_factor_session.js'

/**
 * The second step after the host's password login: renders the shared
 * Auth/TwoFactorChallenge page and checks a TOTP or recovery code
 * (ADR 2026-10-29-configurable-access-features).
 *
 * GET  {prefix}/two-factor/challenge  escalated.two-factor.challenge
 * POST {prefix}/two-factor/challenge  escalated.two-factor.verify (throttled)
 */
export default class TwoFactorChallengeController {
  async show(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    if (!(await confirmedEnrolment(user)) || TwoFactorSession.passed(ctx.session, user)) {
      return ctx.response.redirect().toPath(await this.next(ctx))
    }

    const path = `/${this.prefix()}/two-factor/challenge`
    return getRenderer().render(ctx, 'Escalated/Auth/TwoFactorChallenge', {
      action: `${ctx.request.protocol()}://${ctx.request.host()}${path}`,
      error: String(ctx.session.flashMessages.get('error') ?? ''),
    })
  }

  async verify(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)
    const record = await confirmedEnrolment(user)
    if (!record) {
      return ctx.response.redirect().toPath(await this.next(ctx))
    }

    const challengePath = `/${this.prefix()}/two-factor/challenge`
    const code = String(ctx.request.input('code') ?? '').trim()
    const recoveryCode = String(ctx.request.input('recovery_code') ?? '').trim()
    const usingRecovery = recoveryCode !== ''

    if (!usingRecovery && code === '') {
      ctx.session.flash('errors', { code: 'Enter the code from your authenticator app.' })
      return ctx.response.redirect().toPath(challengePath)
    }
    if (code.length > 16 || recoveryCode.length > 64) {
      ctx.session.flash('errors', {
        [usingRecovery ? 'recovery_code' : 'code']: 'That code is not valid.',
      })
      return ctx.response.redirect().toPath(challengePath)
    }

    const passed = usingRecovery
      ? await consumeRecoveryCode(record, recoveryCode)
      : await consumeCode(record, code)

    if (!passed) {
      logger.info(
        { userId: user.id, ip: ctx.request.ip() },
        'Escalated: two-factor challenge failed'
      )
      ctx.session.flash(
        'errors',
        usingRecovery
          ? { recovery_code: 'That recovery code is not valid.' }
          : { code: 'That code is not valid.' }
      )
      return ctx.response.redirect().toPath(challengePath)
    }

    ctx.session.regenerate()
    TwoFactorSession.markPassed(ctx.session, user)
    return ctx.response.redirect().toPath(await this.next(ctx))
  }

  /** The page the user asked for before the challenge, or their dashboard. */
  protected async next(ctx: HttpContext): Promise<string> {
    const authorization = getConfig().authorization
    const user = ctx.auth?.user
    const isAgent = Boolean(authorization?.isAgent && (await authorization.isAgent(user)))
    const home = isAgent ? `/${this.prefix()}/agent/tickets` : `/${this.prefix()}/admin/reports`
    return TwoFactorSession.pullIntended(ctx.session, home)
  }

  protected prefix(): string {
    return getConfig().routes?.prefix ?? 'support'
  }
}
