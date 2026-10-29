import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { GUEST_RATE_LIMIT_WINDOW_MS } from '../support/guest_rate_limit.js'
import { twoFactorConfig } from '../support/two_factor.js'
import { twoFactorRateLimitStore } from '../support/two_factor_session.js'

/**
 * Throttles the two-factor challenge's verify route: 5 attempts per minute
 * per signed-in user by default (`twoFactor.verifyAttemptsPerMinute`), so a
 * six-digit code cannot be guessed at speed. Over the limit it answers 429
 * with `Retry-After`. Counted per user, falling back to the client IP.
 */
export default class TwoFactorThrottle {
  async handle(ctx: HttpContext, next: NextFn) {
    const config = twoFactorConfig()
    const limit = Math.max(1, Number(config.verifyAttemptsPerMinute ?? 5))
    const store = config.rateLimitStore ?? twoFactorRateLimitStore
    const id = (ctx.auth?.user as { id?: unknown } | undefined)?.id
    const key = `two-factor:${id ?? `ip:${ctx.request.ip()}`}`

    const { count, resetInMs } = await store.hit(key, GUEST_RATE_LIMIT_WINDOW_MS)
    if (count > limit) {
      const retryAfter = Math.max(1, Math.ceil(resetInMs / 1000))
      ctx.response.header('Retry-After', String(retryAfter))
      return ctx.response.tooManyRequests({
        message: 'Too many attempts. Please try again later.',
        retry_after: retryAfter,
      })
    }

    return next()
  }
}
