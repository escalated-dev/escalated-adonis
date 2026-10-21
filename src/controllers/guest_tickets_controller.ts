import type { HttpContext } from '@adonisjs/core/http'
import { signAttachments } from '../support/attachment_access.js'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Department from '../models/department.js'
import EscalatedSetting from '../models/escalated_setting.js'
import AttachmentService from '../services/attachment_service.js'
import TicketService from '../services/ticket_service.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import { getConfig } from '../helpers/config.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'
import { t } from '../support/i18n.js'

export default class GuestTicketsController {
  protected attachmentService = new AttachmentService()
  protected ticketService = new TicketService(this.attachmentService)

  /**
   * GET /support/guest/create — Guest create ticket form
   */
  async create(ctx: HttpContext) {
    if (!(await EscalatedSetting.guestTicketsEnabled())) {
      return ctx.response.notFound()
    }

    const config = getConfig()
    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    return getRenderer().render(ctx, 'Escalated/Guest/Create', {
      departments,
      priorities: config.priorities,
    })
  }

  /**
   * POST /support/guest — Store guest ticket
   */
  async store({ request, response, session }: HttpContext) {
    if (!(await EscalatedSetting.guestTicketsEnabled())) {
      return response.notFound()
    }

    const data = request.only([
      'guest_name',
      'guest_email',
      'subject',
      'description',
      'priority',
      'department_id',
    ])

    const ticket = await this.ticketService.createGuest({
      name: data.guest_name,
      email: data.guest_email,
      subject: data.subject,
      description: data.description,
      priority: data.priority,
      channel: 'web',
      departmentId: data.department_id || null,
      attachments: request.files('attachments'),
    })

    session.flash('success', t('guest.created'))
    return redirectToRoute(response, 'escalated.guest.tickets.show', {
      token: ticket.guestToken,
    })
  }

  /**
   * GET /support/guest/:token — Show guest ticket
   */
  async show(ctx: HttpContext) {
    const ticket = await Ticket.query().where('guest_token', ctx.params.token).firstOrFail()

    await ticket.load('department')
    await ticket.load((loader: any) => {
      loader.load('replies', (query: any) => {
        query.preload('attachments').where('is_internal_note', false).orderBy('created_at', 'desc')
      })
    })

    // Short-lived links to the access-checked download route.
    await ticket.load('attachments')
    await signAttachments([ticket, ...(ticket.replies ?? [])], { guestTicket: ticket })

    return getRenderer().render(ctx, 'Escalated/Guest/Show', {
      ticket,
      token: ctx.params.token,
    })
  }

  /**
   * POST /support/guest/:token/reply — Reply to guest ticket
   */
  async reply({ params, request, response, session }: HttpContext) {
    const ticket = await Ticket.query().where('guest_token', params.token).firstOrFail()

    if (ticket.status === 'closed') {
      session.flash('error', t('guest.ticket_closed'))
      return response.redirect().back()
    }

    const { body } = request.only(['body'])

    const reply = await Reply.create({
      ticketId: ticket.id,
      authorType: null,
      authorId: null,
      body,
      isInternalNote: false,
      isPinned: false,
      type: 'reply',
    })

    const attachments = request.files('attachments')
    if (attachments && attachments.length > 0) {
      await this.attachmentService.storeMany('Reply', reply.id, attachments)
    }

    await emitter.emit(ESCALATED_EVENTS.REPLY_CREATED, { reply })

    session.flash('success', t('guest.reply_sent'))
    return response.redirect().back()
  }
}
