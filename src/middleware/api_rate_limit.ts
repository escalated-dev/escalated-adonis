import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { getConfig } from '../helpers/config.js'

/**
 * Simple in-memory rate limiter for the Escalated API.
 *
 * Tracks requests per token (or per IP for unauthenticated requests)
 * within a sliding 60-second window. Configurable via
 * `escalated.api.rateLimit` (default: 60 requests per minute).
 *
 * In production, consider replacing this with a Redis-backed limiter.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map()

// Clean up stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 120_000
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key)
    }
  }
}, 300_000).unref()

export default class ApiRateLimit {
  async handle(ctx: HttpContext, next: NextFn) {
    const apiToken = (ctx as any).apiToken
    const key = `escalated_api:${apiToken ? apiToken.id : ctx.request.ip()}`

    const config = getConfig() as any
    const maxAttempts = config.api?.rateLimit ?? 60
    const windowMs = 60_000

    const now = Date.now()
    const entry = rateLimitStore.get(key) ?? { timestamps: [] }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs)

    if (entry.timestamps.length >= maxAttempts) {
      // Calculate retry-after in seconds
      const oldestInWindow = entry.timestamps[0]
      const retryAfter = Math.ceil((oldestInWindow + windowMs - now) / 1000)

      rateLimitStore.set(key, entry)

      ctx.response.header('Retry-After', String(retryAfter))
      ctx.response.header('X-RateLimit-Limit', String(maxAttempts))
      ctx.response.header('X-RateLimit-Remaining', '0')

      return ctx.response.tooManyRequests({
        message: 'Too many requests.',
        retry_after: retryAfter,
      })
    }

    // Record this request
    entry.timestamps.push(now)
    rateLimitStore.set(key, entry)

    const remaining = maxAttempts - entry.timestamps.length

    // Process the request
    await next()

    // Add rate limit headers to the response
    ctx.response.header('X-RateLimit-Limit', String(maxAttempts))
    ctx.response.header('X-RateLimit-Remaining', String(remaining))
  }
}
