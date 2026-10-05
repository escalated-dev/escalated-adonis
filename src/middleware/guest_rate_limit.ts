import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { getConfig } from '../helpers/config.js'
import { checkGuestRateLimit, type GuestRateLimitScope } from '../support/guest_rate_limit.js'

/**
 * Per-client-IP rate limit for the unauthenticated guest endpoints: ticket
 * creation (`scope: 'ticket'`) and guest replies (`scope: 'reply'`), each with
 * its own counter over a 60-second window. Over the limit it answers 429 with
 * `Retry-After`.
 *
 * On the reply route it runs before the guest token is looked up, so requests
 * with a wrong token are counted too and tokens cannot be guessed at speed.
 *
 * The client IP is `request.ip()`. Behind a load balancer or reverse proxy the
 * host must set `http.trustProxy` in `config/app.ts`, or every guest shares the
 * proxy's address and one limit.
 */
export default class GuestRateLimit {
  async handle(ctx: HttpContext, next: NextFn, options: { scope: GuestRateLimitScope }) {
    const decision = await checkGuestRateLimit(
      getConfig().guestRateLimit,
      options.scope,
      ctx.request.ip()
    )

    if (!decision.allowed) {
      ctx.response.header('Retry-After', String(decision.retryAfterSeconds))
      return ctx.response.tooManyRequests({
        message: 'Too many requests. Please try again later.',
        retry_after: decision.retryAfterSeconds,
      })
    }

    return next()
  }
}
