import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { privateResponse } from '../support/guest_access.js'

/**
 * Marks every answer from a guest route private, errors and rate-limit
 * refusals included: `Cache-Control: no-store, private` and
 * `Referrer-Policy: no-referrer`. Guest answers and URLs carry grants.
 */
export default class GuestPrivacyHeaders {
  async handle(ctx: HttpContext, next: NextFn) {
    privateResponse(ctx.response)
    return next()
  }
}
