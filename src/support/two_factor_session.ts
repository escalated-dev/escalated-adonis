/*
|--------------------------------------------------------------------------
| Two-factor session state
|--------------------------------------------------------------------------
|
| Which user this session has passed the two-factor challenge for, and the
| page they asked for before they were sent to it. The pass is stored as the
| user's id, so a session that passed for one user does not count for
| another, and it is cleared on every login and logout (the host session
| guard's `session_auth:login_succeeded` / `session_auth:logged_out` events).
|
*/

import { MemoryGuestRateLimitStore } from './guest_rate_limit.js'

/** The minimal session surface used here (Adonis `ctx.session`). */
export interface TwoFactorSessionStore {
  get(key: string, defaultValue?: any): any
  put(key: string, value: any): void
  forget(key: string): void
}

const PASSED_KEY = 'escalated.two_factor.passed'
const INTENDED_KEY = 'escalated.two_factor.intended'
const PENDING_CODES_KEY = 'escalated.two_factor.pending_recovery_codes'

function userKey(user: any): string | null {
  const id = user?.id
  return id === undefined || id === null ? null : String(id)
}

const TwoFactorSession = {
  PASSED_KEY,

  passed(session: TwoFactorSessionStore | null | undefined, user: any): boolean {
    const key = userKey(user)
    return Boolean(session && key !== null && session.get(PASSED_KEY) === key)
  },

  markPassed(session: TwoFactorSessionStore, user: any): void {
    const key = userKey(user)
    if (key !== null) session.put(PASSED_KEY, key)
  },

  forget(session: TwoFactorSessionStore | null | undefined): void {
    session?.forget(PASSED_KEY)
  },

  /** Remembers a same-site path to return to after the challenge or enrolment. */
  setIntended(session: TwoFactorSessionStore, url: string): void {
    if (isLocalPath(url)) session.put(INTENDED_KEY, url)
  },

  /** The remembered path, removed from the session, or `fallback`. */
  pullIntended(session: TwoFactorSessionStore, fallback: string): string {
    const url = session.get(INTENDED_KEY)
    session.forget(INTENDED_KEY)
    return typeof url === 'string' && isLocalPath(url) ? url : fallback
  },

  /**
   * The plaintext recovery codes issued by `setup`, kept in the user's own
   * session until `confirm` shows them (the database only holds hashes).
   */
  putPendingRecoveryCodes(session: TwoFactorSessionStore, codes: string[]): void {
    session.put(PENDING_CODES_KEY, codes)
  },

  pullPendingRecoveryCodes(session: TwoFactorSessionStore): string[] | null {
    const codes = session.get(PENDING_CODES_KEY)
    session.forget(PENDING_CODES_KEY)
    return Array.isArray(codes) ? codes.map(String) : null
  },
}

export default TwoFactorSession

/** A path on this site: `/x`, never `//host` or `/\host`, which browsers treat as another site. */
function isLocalPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')
}

/**
 * Counters for the challenge's verify route (5 attempts per minute per user by
 * default; `twoFactor.verifyAttemptsPerMinute`). Per process unless the host
 * supplies a shared `twoFactor.rateLimitStore`.
 */
export const twoFactorRateLimitStore = new MemoryGuestRateLimitStore()
