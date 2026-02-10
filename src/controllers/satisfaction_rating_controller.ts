import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../models/ticket.js'
import SatisfactionRating from '../models/satisfaction_rating.js'

export default class SatisfactionRatingController {
  /**
   * POST /support/:ticket/rate — Rate a resolved/closed ticket (authenticated)
   */
  async store(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const user = ctx.auth.user!
    const { rating, comment } = ctx.request.only(['rating', 'comment'])

    if (!['resolved', 'closed'].includes(ticket.status)) {
      ctx.session.flash('error', 'You can only rate resolved or closed tickets.')
      return ctx.response.redirect().back()
    }

    const existing = await SatisfactionRating.query().where('ticket_id', ticket.id).first()
    if (existing) {
      ctx.session.flash('error', 'This ticket has already been rated.')
      return ctx.response.redirect().back()
    }

    await SatisfactionRating.create({
      ticketId: ticket.id,
      rating: Number(rating),
      comment: comment || null,
      ratedByType: user.constructor.name,
      ratedById: user.id,
    })

    ctx.session.flash('success', 'Thank you for your feedback!')
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/guest/:token/rate — Rate a ticket as guest
   */
  async storeGuest({ params, request, response, session }: HttpContext) {
    const ticket = await Ticket.query()
      .where('guest_token', params.token)
      .firstOrFail()

    const { rating, comment } = request.only(['rating', 'comment'])

    if (!['resolved', 'closed'].includes(ticket.status)) {
      session.flash('error', 'You can only rate resolved or closed tickets.')
      return response.redirect().back()
    }

    const existing = await SatisfactionRating.query().where('ticket_id', ticket.id).first()
    if (existing) {
      session.flash('error', 'This ticket has already been rated.')
      return response.redirect().back()
    }

    await SatisfactionRating.create({
      ticketId: ticket.id,
      rating: Number(rating),
      comment: comment || null,
      ratedByType: null,
      ratedById: null,
    })

    session.flash('success', 'Thank you for your feedback!')
    return response.redirect().back()
  }
}
