import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { restrictedTicketAccess, withTicketAccess } from '../support/ticket_access.js'

export default class TicketAccessMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!restrictedTicketAccess()) return next()
    const auth = (ctx as any).auth
    // Public widget routes can still carry an authenticated agent session.
    if (!auth?.user && typeof auth?.check === 'function') await auth.check()
    return withTicketAccess(auth?.user ?? null, next)
  }
}
