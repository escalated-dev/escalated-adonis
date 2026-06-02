import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { getConfig } from '../helpers/config.js'

/**
 * Returns 404 when newsletters are disabled (per-request guard for public + webhook routes).
 */
export default class EnsureNewslettersEnabled {
  async handle(ctx: HttpContext, next: NextFn) {
    const config = getConfig() as { enableNewsletters?: boolean }
    if (!config.enableNewsletters) {
      return ctx.response.status(404).send('Not Found')
    }
    return next()
  }
}
