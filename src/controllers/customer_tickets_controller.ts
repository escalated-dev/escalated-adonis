import type { HttpContext } from '@adonisjs/core/http'
import Department from '../models/department.js'
import TicketService from '../services/ticket_service.js'
import { getConfig } from '../helpers/config.js'
import { t } from '../support/i18n.js'

export default class CustomerTicketsController {
  protected ticketService = new TicketService()

  /**
   * GET /support — List customer's tickets
   */
  async index({ request, auth, inertia }: HttpContext) {
    const user = auth.user!
    const filters = request.only(['status', 'search', 'sort_by', 'sort_dir'])

    const tickets = await this.ticketService.list(filters, user as any)

    return inertia.render('Escalated/Customer/Index', {
      tickets,
      filters: request.only(['status', 'search']),
    })
  }

  /**
   * GET /support/create — Show create ticket form
   */
  async create({ inertia }: HttpContext) {
    const config = getConfig()
    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    return inertia.render('Escalated/Customer/Create', {
      departments,
      priorities: config.priorities,
    })
  }

  /**
   * POST /support — Store new ticket
   */
  async store({ request, auth, response, session }: HttpContext) {
    const user = auth.user!

    const data = request.only(['subject', 'description', 'priority', 'department_id'])
    const attachments = request.files('attachments')

    const ticket = await this.ticketService.create(user as any, {
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      departmentId: data.department_id,
      attachments,
    })

    session.flash('success', t('ticket.created'))
    return response.redirect().toRoute('escalated.customer.tickets.show', { ticket: ticket.reference })
  }

  /**
   * GET /support/:ticket — Show ticket detail
   */
  async show(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket
    const user = ctx.auth.user!

    this.authorizeCustomer(ticket, user)

    await ticket.load('department')
    await ticket.load('tags')
    await ticket.load((loader: any) => {
      loader.load('replies', (query: any) => {
        query.where('is_internal_note', false).orderBy('created_at', 'desc')
      })
    })

    return ctx.inertia.render('Escalated/Customer/Show', {
      ticket,
    })
  }

  /**
   * POST /support/:ticket/reply — Reply to ticket
   */
  async reply(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket
    const user = ctx.auth.user!

    this.authorizeCustomer(ticket, user)

    const { body } = ctx.request.only(['body'])
    const attachments = ctx.request.files('attachments')

    await this.ticketService.reply(ticket, user as any, body, attachments)

    ctx.session.flash('success', t('ticket.reply_sent'))
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/:ticket/close — Close ticket
   */
  async close(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket
    const user = ctx.auth.user!
    const config = getConfig()

    this.authorizeCustomer(ticket, user)

    if (!config.tickets.allowCustomerClose) {
      return ctx.response.forbidden({ error: t('ticket.customer_close_forbidden') })
    }

    await this.ticketService.close(ticket, user as any)

    ctx.session.flash('success', t('ticket.closed'))
    return ctx.response.redirect().back()
  }

  /**
   * POST /support/:ticket/reopen — Reopen ticket
   */
  async reopen(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket
    const user = ctx.auth.user!

    this.authorizeCustomer(ticket, user)

    await this.ticketService.reopen(ticket, user as any)

    ctx.session.flash('success', t('ticket.reopened'))
    return ctx.response.redirect().back()
  }

  protected authorizeCustomer(ticket: any, user: any): void {
    if (ticket.requesterType !== user.constructor.name || ticket.requesterId !== user.id) {
      throw new Error('Unauthorized')
    }
  }
}
