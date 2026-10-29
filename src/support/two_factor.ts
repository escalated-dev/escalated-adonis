/*
|--------------------------------------------------------------------------
| Two-factor enforcement
|--------------------------------------------------------------------------
|
| ADR 2026-10-29-configurable-access-features. Used while `access.twoFactor`
| (ESCALATED_TWO_FACTOR) is on:
|
| - a staff user with a confirmed enrolment passes Auth/TwoFactorChallenge
|   once per login before any admin or agent route (RequireTwoFactor);
| - when two-factor is required, staff without an enrolment are sent to enrol.
|
*/

import TwoFactor from '../models/two_factor.js'
import EscalatedSetting from '../models/escalated_setting.js'
import TwoFactorService from '../services/two_factor_service.js'
import { escalatedDb, getConfig } from '../helpers/config.js'
import { twoFactorEnabled } from './access_features.js'
import { isStaff } from './attachment_access.js'

export { isStaff }

/** `twoFactor` in config/escalated.ts. */
export interface TwoFactorConfig {
  /**
   * Send every staff user without an enrolment to set one up. The
   * `two_factor_required` setting (Admin > Settings) wins once saved.
   * Unset: ESCALATED_TWO_FACTOR_REQUIRED.
   */
  required?: boolean
  /** The name authenticator apps show. Unset: ESCALATED_TWO_FACTOR_ISSUER, then APP_NAME. */
  issuer?: string
  /** Challenge attempts per user per minute. Default 5. */
  verifyAttemptsPerMinute?: number
  /** Where the attempt counters live. Default: in memory, per process. */
  rateLimitStore?: import('./guest_rate_limit.js').GuestRateLimitStore
}

export function twoFactorConfig(): TwoFactorConfig {
  return ((getConfig() as any).twoFactor ?? {}) as TwoFactorConfig
}

function envFlag(name: string): boolean {
  const value = process.env[name]
  return (
    typeof value === 'string' && ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase())
  )
}

/** `twoFactor.required`, or ESCALATED_TWO_FACTOR_REQUIRED when config leaves it unset. */
export function configuredRequired(): boolean {
  const value = twoFactorConfig().required
  if (value === undefined || value === null) return envFlag('ESCALATED_TWO_FACTOR_REQUIRED')
  return value === true || value === ('true' as unknown)
}

/** The issuer authenticator apps show next to the code. */
export function twoFactorIssuer(): string {
  return (
    twoFactorConfig().issuer ||
    process.env.ESCALATED_TWO_FACTOR_ISSUER ||
    process.env.APP_NAME ||
    'Escalated'
  )
}

/**
 * Whether staff must enrol: the saved `two_factor_required` setting when an
 * admin has saved it, else the config. Only while the switch is on.
 */
export async function twoFactorRequired(): Promise<boolean> {
  if (!twoFactorEnabled()) return false
  try {
    return await EscalatedSetting.getBool('two_factor_required', configuredRequired())
  } catch {
    return configuredRequired()
  }
}

/** The user's confirmed enrolment, or null. */
export async function confirmedEnrolment(user: any): Promise<TwoFactor | null> {
  if (user?.id === undefined || user?.id === null) return null
  return TwoFactor.query().where('user_id', user.id).whereNotNull('confirmed_at').first()
}

const service = new TwoFactorService()

/**
 * Checks a TOTP code for an enrolment and records its time step. A code for
 * the recorded step or an earlier one is refused, so each code works once.
 * The step is written with a conditional update, so two requests racing with
 * the same code cannot both succeed.
 */
export async function consumeCode(record: TwoFactor, code: string): Promise<boolean> {
  const step = service.matchStep(record.secret, code, record.lastUsedStep ?? null)
  if (step === null) return false

  const db = await escalatedDb()
  const updated = await db
    .from(TwoFactor.table)
    .where('id', record.id)
    .where((query: any) => query.whereNull('last_used_step').orWhere('last_used_step', '<', step))
    .update({ last_used_step: step })

  if (affectedRows(updated) !== 1) return false
  record.lastUsedStep = step
  return true
}

/** Uses a recovery code: true, and the code is removed, when it matches one. */
export async function consumeRecoveryCode(record: TwoFactor, code: string): Promise<boolean> {
  const result = service.verifyRecoveryCode(record.recoveryCodes ?? [], code)
  if (!result.valid) return false
  record.recoveryCodes = result.remaining
  await record.save()
  return true
}

/** knex reports an UPDATE's row count as a number, or `[number]` on some drivers. */
function affectedRows(result: unknown): number {
  if (typeof result === 'number') return result
  if (Array.isArray(result) && typeof result[0] === 'number') return result[0]
  return Number(result) || 0
}
