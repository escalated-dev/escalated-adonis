import type { HttpContext } from '@adonisjs/core/http'
import { signAttachments } from '../support/attachment_access.js'
import { Exception } from '@adonisjs/core/exceptions'
import Department from '../models/department.js'
import TicketService from '../services/ticket_service.js'
import CustomFieldService from '../services/custom_field_service.js'
import { getConfig } from '../helpers/config.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'
import { t } from '../support/i18n.js'

export default class CustomerTicketsController {
  protected ticketService = new TicketService()
  protected customFields = new CustomFieldService()

  /**
   * GET /support — List customer's tickets
   */
  async index(ctx: HttpContext) {
    const user = ctx.auth.user!
    const filters = ctx.request.only(['status', 'search', 'sort_by', 'sort_dir'])

    const tickets = await this.ticketService.list(filters, user as any)

    return getRenderer().render(ctx, 'Escalated/Customer/Index', {
      tickets,
      filters: ctx.request.only(['status', 'search']),
    })
  }

  /**
   * GET /support/create — Show create ticket form
   */
  async create(ctx: HttpContext) {
    const config = getConfig()
    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    return getRenderer().render(ctx, 'Escalated/Customer/Create', {
      departments,
      priorities: config.priorities,
      custom_fields: await this.customFields.ticketDefinitions(),
    })
  }

  /**
   * POST /support — Store new ticket
   */
  async store({ request, auth, response, session }: HttpContext) {
    const user = auth.user!

    const data = request.only(['subject', 'description', 'priority', 'department_id'])
    const attachments = request.files('attachments')

    // Custom field values are checked before the ticket is written.
    const custom = await this.customFields.validateTicketInput(
      request.input('custom_fields'),
      'create'
    )
    if (Object.keys(custom.errors).length > 0) {
      session.flash('errors', custom.errors)
      return response.redirect().back()
    }

    const ticket = await this.ticketService.create(user as any, {
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      departmentId: data.department_id,
      attachments,
    })
    await this.customFields.saveTicketValues(ticket.id, custom.values)

    session.flash('success', t('ticket.created'))
    return redirectToRoute(response, 'escalated.customer.tickets.show', {
      ticket: ticket.reference,
    })
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
        query.preload('attachments').where('is_internal_note', false).orderBy('created_at', 'desc')
      })
    })

    // Short-lived links to the access-checked download route.
    await ticket.load('attachments')
    await signAttachments([ticket, ...(ticket.replies ?? [])])

    return getRenderer().render(ctx, 'Escalated/Customer/Show', {
      ticket,
      custom_fields: await this.customFields.ticketValues(ticket.id),
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

  /**
   * Only the ticket's requester may act on it. Refuses with 403 (an
   * exception carrying its status, which the host's exception handler
   * renders) rather than a bare Error, which answered 500. Keys compare as
   * strings: drivers return bigint keys as strings while hosts may hold
   * numbers.
   */
  protected authorizeCustomer(ticket: any, user: any): void {
    const owns =
      user &&
      ticket.requesterType === user.constructor.name &&
      ticket.requesterId !== null &&
      ticket.requesterId !== undefined &&
      String(ticket.requesterId) === String(user.id)
    if (!owns) {
      throw new Exception('This action is unauthorized.', {
        status: 403,
        code: 'E_AUTHORIZATION_FAILURE',
      })
    }
  }
}
