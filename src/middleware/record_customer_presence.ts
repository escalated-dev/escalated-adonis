import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { quietly, seeUser } from '../services/agent_panel.js'

/**
 * Customer-portal requests record that the signed-in customer is on the site
 * (throttled; ADR 2026-11-05-agent-panel-data). Staff browsing the portal are
 * not recorded. Presence is a hint and never fails the request.
 */
export default class RecordCustomerPresence {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = (ctx as any).auth?.user
    if (user) await quietly(() => seeUser(user))
    return next()
  }
}
