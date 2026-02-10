import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Ticket from '../models/ticket.js'

/**
 * Middleware to resolve a ticket by reference or ID.
 * Adds the resolved Ticket model instance to ctx.params.ticket.
 */
export default class ResolveTicket {
  async handle(ctx: HttpContext, next: NextFn) {
    const ticketParam = ctx.params.ticket

    if (ticketParam) {
      const ticket = await Ticket.query()
        .where('reference', ticketParam)
        .orWhere('id', isNaN(Number(ticketParam)) ? 0 : Number(ticketParam))
        .firstOrFail()

      // Store the resolved ticket on the context for controllers to access
      ;(ctx as any).escalatedTicket = ticket
    }

    return next()
  }
}
