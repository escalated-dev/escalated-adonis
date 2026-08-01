import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import TwoFactor from '../models/two_factor.js'
import TwoFactorService from '../services/two_factor_service.js'
import { requireAuthUser } from '../support/auth_user.js'
import { getRenderer } from '../rendering/renderer.js'

/**
 * Two-factor authentication (TOTP + recovery codes) for agents/admins.
 *
 * Ports the Laravel `TwoFactorController` (index/setup/confirm/disable) and adds
 * recovery-code regeneration plus a post-login challenge/verify path, matching
 * the Symfony service semantics.
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

    const email = (user as any).email ?? ''
    ctx.session.flash('two_factor_setup', {
      qr_uri: this.service.generateQrUri(secret, email),
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

    const userId = requireAuthUser(ctx.auth).id
    const record = await TwoFactor.query()
      .where('user_id', userId)
      .whereNull('confirmed_at')
      .first()

    if (!record) {
      ctx.session.flash('errors', { code: 'No pending two-factor setup found.' })
      return ctx.response.redirect().back()
    }

    if (!this.service.verify(record.secret, code)) {
      ctx.session.flash('errors', { code: 'Invalid verification code.' })
      return ctx.response.redirect().back()
    }

    record.confirmedAt = DateTime.now()
    await record.save()

    ctx.session.flash('success', 'Two-factor authentication enabled.')
    ctx.session.flash('two_factor_confirmed', true)
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/admin/settings/two-factor/disable — remove enrollment.
   */
  async disable(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    await TwoFactor.query().where('user_id', userId).delete()

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

    ctx.session.flash('success', 'Recovery codes regenerated.')
    ctx.session.flash('two_factor_recovery_codes', recoveryCodes)
    return ctx.response.redirect().back()
  }

  /**
   * GET /support/two-factor/challenge — render the post-login challenge page.
   */
  async challenge(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Auth/TwoFactorChallenge', {})
  }

  /**
   * POST /support/two-factor/challenge — verify a TOTP code or a single-use
   * recovery code at login/challenge time.
   */
  async verify(ctx: HttpContext) {
    const userId = requireAuthUser(ctx.auth).id
    const record = await TwoFactor.query()
      .where('user_id', userId)
      .whereNotNull('confirmed_at')
      .first()

    if (!record) {
      ctx.session.flash('errors', { code: 'Two-factor authentication is not enabled.' })
      return ctx.response.redirect().back()
    }

    const code = String(ctx.request.input('code', '')).trim()
    const recoveryCode = String(ctx.request.input('recovery_code', '')).trim()

    // Recovery-code path (single use): consume the matched code on success.
    if (recoveryCode) {
      const result = this.service.verifyRecoveryCode(record.recoveryCodes ?? [], recoveryCode)
      if (!result.valid) {
        ctx.session.flash('errors', { code: 'Invalid recovery code.' })
        return ctx.response.redirect().back()
      }
      record.recoveryCodes = result.remaining
      await record.save()
    } else if (!code || !this.service.verify(record.secret, code)) {
      ctx.session.flash('errors', { code: 'Invalid verification code.' })
      return ctx.response.redirect().back()
    }

    // Mark this session as having passed the two-factor challenge. Host apps can
    // gate sensitive routes on this flag.
    ctx.session.put('two_factor_passed', true)
    ctx.session.flash('success', 'Two-factor challenge passed.')
    return ctx.response.redirect().back()
  }
}
