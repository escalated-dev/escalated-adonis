import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Plays a host's security headers (as @adonisjs/shield sends them): no
 * framing at all and a content security policy, set after the route has run,
 * so they are the last thing a middleware writes.
 */
export default class HostHeadersMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const output = await next()
    ctx.response.header('X-Frame-Options', 'DENY')
    ctx.response.header('Content-Security-Policy', "default-src 'self'")
    return output
  }
}
