/*
|--------------------------------------------------------------------------
| Guest endpoint rate limit
|--------------------------------------------------------------------------
|
| Per-client-IP counters for the unauthenticated guest endpoints. Every
| accepted guest ticket or reply writes rows and sends outbound mail, so an
| uncapped endpoint lets anyone flood the helpdesk and the mail provider.
|
| Limits come from `escalated.guestRateLimit` (defaults: 5 ticket submissions
| and 10 replies per IP per minute). Counters live in `guestRateLimit.store`
| when the host supplies a shared one, otherwise in a per-process in-memory
| store.
|
*/

export type GuestRateLimitScope = 'ticket' | 'reply'

/** The result of counting one request against a key. */
export interface GuestRateLimitHit {
  /** Requests counted against the key in the current window, this one included. */
  count: number
  /** Milliseconds until the current window ends and the count resets. */
  resetInMs: number
}

/**
 * Where guest rate-limit counters live. The default is in memory, per process;
 * a multi-instance deployment should supply a shared store (Redis, the
 * database, ...) so every instance sees the same counts.
 */
export interface GuestRateLimitStore {
  /** Counts one request against `key` in a fixed window of `windowMs`. */
  hit(key: string, windowMs: number): GuestRateLimitHit | Promise<GuestRateLimitHit>
}

export interface GuestRateLimitConfig {
  /** Default true. Set false only when the host already throttles upstream. */
  enabled?: boolean
  /** Guest ticket submissions per IP per minute. Default 5. */
  ticketsPerMinute?: number
  /** Guest replies per IP per minute. Default 10. */
  repliesPerMinute?: number
  /** Where the counters live. Default: in memory, per process. */
  store?: GuestRateLimitStore
}

export const GUEST_RATE_LIMIT_WINDOW_MS = 60_000

const DEFAULT_LIMITS: Record<GuestRateLimitScope, number> = { ticket: 5, reply: 10 }

/** A fixed-window counter held in this process's memory. */
export class MemoryGuestRateLimitStore implements GuestRateLimitStore {
  #windows = new Map<string, { count: number; resetAt: number }>()
  #now: () => number

  constructor(now: () => number = Date.now) {
    this.#now = now
  }

  hit(key: string, windowMs: number): GuestRateLimitHit {
    const now = this.#now()
    this.#sweep(now)

    let window = this.#windows.get(key)
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs }
      this.#windows.set(key, window)
    }
    window.count++

    return { count: window.count, resetInMs: window.resetAt - now }
  }

  clear() {
    this.#windows.clear()
  }

  /** Drops expired windows once the map grows, so one-off IPs do not pile up. */
  #sweep(now: number) {
    if (this.#windows.size < 1000) return
    for (const [key, window] of this.#windows) {
      if (window.resetAt <= now) this.#windows.delete(key)
    }
  }
}

/** The store used when the host does not configure one. */
export const defaultGuestRateLimitStore = new MemoryGuestRateLimitStore()

export type GuestRateLimitDecision =
  { allowed: true } | { allowed: false; retryAfterSeconds: number; limit: number }

/**
 * Counts one guest request from `ip` against the `scope` bucket and says
 * whether it may proceed.
 */
export async function checkGuestRateLimit(
  config: GuestRateLimitConfig | undefined,
  scope: GuestRateLimitScope,
  ip: string
): Promise<GuestRateLimitDecision> {
  const options = config ?? {}
  if (options.enabled === false) {
    return { allowed: true }
  }

  const limit =
    (scope === 'ticket' ? options.ticketsPerMinute : options.repliesPerMinute) ??
    DEFAULT_LIMITS[scope]
  const store = options.store ?? defaultGuestRateLimitStore

  const { count, resetInMs } = await store.hit(
    `escalated:guest:${scope}:${ip}`,
    GUEST_RATE_LIMIT_WINDOW_MS
  )

  if (count <= limit) {
    return { allowed: true }
  }

  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(resetInMs / 1000)), limit }
}
