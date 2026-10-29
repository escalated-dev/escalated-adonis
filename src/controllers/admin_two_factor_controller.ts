import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import TwoFactor from '../models/two_factor.js'
import TwoFactorService from '../services/two_factor_service.js'
import AuditService from '../services/audit_service.js'
import { AUDIT_ACTIONS } from '../support/audit_events.js'
import { requireAuthUser } from '../support/auth_user.js'
import { getRenderer } from '../rendering/renderer.js'
import {
  confirmedEnrolment,
  consumeCode,
  twoFactorIssuer,
  twoFactorRequired,
} from '../support/two_factor.js'
import TwoFactorSession from '../support/two_factor_session.js'

/**
 * Two-factor enrolment (TOTP + recovery codes) for the signed-in staff user,
 * agents as well as admins. Ports the Laravel `TwoFactorController`
 * (index/setup/confirm/disable) and adds recovery-code regeneration. The
 * post-login challenge is TwoFactorChallengeController.
 *
 * 404 while `access.twoFactor` is off (ADR 2026-10-29-configurable-access-features).
 */
export default class AdminTwoFactorController {
  private service = new TwoFactorService()

  /**
   * GET /support/admin/settings/two-factor — enrollment status page.
   */
  async index(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    const record = await TwoFactor.query().where('user_id', userId).first()

    return getRenderer().render(ctx, 'Escalated/Admin/Settings/TwoFactor', {
      enabled: record?.isConfirmed() ?? false,
      pending: !!record && !record.isConfirmed(),
      required: await twoFactorRequired(),
    })
  }

  /**
   * POST /support/admin/settings/two-factor/setup — begin enrollment.
   *
   * Replaces any pending (unconfirmed) setup, generates a fresh secret and
   * recovery codes, and flashes the QR URI + plaintext recovery codes (shown
   * once). The secret is stored encrypted; recovery codes are stored hashed.
   */
  async setup(ctx: HttpContext) {
    const user = requireAuthUser(ctx.auth)

    if (await confirmedEnrolment(user)) {
      ctx.session.flash(
        'error',
        'Two-factor authentication is already enabled. Disable it first to set it up again.'
      )
      return ctx.response.redirect().back()
    }

    // Drop any previous unconfirmed setup for this user.
    await TwoFactor.query().where('user_id', user.id).whereNull('confirmed_at').delete()

    const secret = this.service.generateSecret()
    const recoveryCodes = this.service.generateRecoveryCodes()

    await TwoFactor.create({
      userId: user.id,
      secret,
      recoveryCodes: recoveryCodes.map((code) => this.service.hashRecoveryCode(code)),
      confirmedAt: null,
    })

    // Shown again once the code is confirmed; the database keeps only hashes.
    TwoFactorSession.putPendingRecoveryCodes(ctx.session, recoveryCodes)

    const email = (user as any).email ?? String(user.id)
    ctx.session.flash('two_factor_setup', {
      qr_uri: this.service.generateQrUri(secret, email, twoFactorIssuer()),
      recovery_codes: recoveryCodes,
    })
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/admin/settings/two-factor/confirm — confirm enrollment by
   * verifying the first TOTP code.
   */
  async confirm(ctx: HttpContext) {
    const code = String(ctx.request.input('code', '')).trim()
    if (!/^\d{6}$/.test(code)) {
      ctx.session.flash('errors', { code: 'Enter the 6-digit code from your authenticator app.' })
      return ctx.response.redirect().back()
    }

    const user = requireAuthUser(ctx.auth)
    const userId = user.id
    const record = await TwoFactor.query()
      .where('user_id', userId)
      .whereNull('confirmed_at')
      .first()

    if (!record) {
      ctx.session.flash('errors', { code: 'No pending two-factor setup found.' })
      return ctx.response.redirect().back()
    }

    // Records the code's time step, so the code cannot be replayed at the challenge.
    if (!(await consumeCode(record, code))) {
      ctx.session.flash('errors', { code: 'Invalid verification code.' })
      return ctx.response.redirect().back()
    }

    // The setup's codes, from this session; issued afresh if confirmed elsewhere.
    let recoveryCodes = TwoFactorSession.pullPendingRecoveryCodes(ctx.session)
    const hashes = record.recoveryCodes ?? []
    if (
      !recoveryCodes ||
      recoveryCodes.length !== hashes.length ||
      !recoveryCodes.every((plain) => hashes.includes(this.service.hashRecoveryCode(plain)))
    ) {
      recoveryCodes = this.service.generateRecoveryCodes()
      record.recoveryCodes = recoveryCodes.map((plain) => this.service.hashRecoveryCode(plain))
    }

    record.confirmedAt = DateTime.now()
    await record.save()

    // The code just entered proves the second factor for this session.
    TwoFactorSession.markPassed(ctx.session, user)

    await AuditService.fromContext(ctx, AUDIT_ACTIONS.TWO_FACTOR_ENABLED, {
      auditableType: 'TwoFactor',
      auditableId: userId,
    })

    ctx.session.flash('success', 'Two-factor authentication enabled.')
    ctx.session.flash('two_factor_confirmed', { recovery_codes: recoveryCodes })
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/admin/settings/two-factor/disable — remove enrollment.
   */
  async disable(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    await TwoFactor.query().where('user_id', userId).delete()

    await AuditService.fromContext(ctx, AUDIT_ACTIONS.TWO_FACTOR_DISABLED, {
      auditableType: 'TwoFactor',
      auditableId: userId,
    })

    ctx.session.flash('success', 'Two-factor authentication disabled.')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/admin/settings/two-factor/recovery-codes — regenerate the
   * single-use recovery codes for a confirmed enrollment.
   */
  async regenerateRecoveryCodes(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    const record = await TwoFactor.query()
      .where('user_id', userId)
      .whereNotNull('confirmed_at')
      .first()

    if (!record) {
      ctx.session.flash('errors', { recovery: 'Two-factor authentication is not enabled.' })
      return ctx.response.redirect().back()
    }

    const recoveryCodes = this.service.generateRecoveryCodes()
    record.recoveryCodes = recoveryCodes.map((code) => this.service.hashRecoveryCode(code))
    await record.save()

    await AuditService.fromContext(ctx, AUDIT_ACTIONS.TWO_FACTOR_RECOVERY_CODES_REGENERATED, {
      auditableType: 'TwoFactor',
      auditableId: userId,
    })

    ctx.session.flash('success', 'Recovery codes regenerated.')
    ctx.session.flash('two_factor_recovery_codes', recoveryCodes)
    return ctx.response.redirect().back()
  }
}
