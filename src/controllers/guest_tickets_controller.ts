import type { HttpContext } from '@adonisjs/core/http'
import emitter from '@adonisjs/core/services/emitter'
import { string } from '@adonisjs/core/helpers'
import Ticket from '../models/ticket.js'
import Reply from '../models/reply.js'
import Department from '../models/department.js'
import EscalatedSetting from '../models/escalated_setting.js'
import AttachmentService from '../services/attachment_service.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import { getConfig } from '../helpers/config.js'
import type { TicketPriority } from '../types.js'

export default class GuestTicketsController {
  protected attachmentService = new AttachmentService()

  /**
   * GET /support/guest/create — Guest create ticket form
   */
  async create({ inertia, response }: HttpContext) {
    if (!(await EscalatedSetting.guestTicketsEnabled())) {
      return response.notFound()
    }

    const config = getConfig()
    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .select('id', 'name')

    return inertia.render('Escalated/Guest/Create', {
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

    const config = getConfig()
    const data = request.only([
      'guest_name', 'guest_email', 'subject', 'description',
      'priority', 'department_id',
    ])

    const ticket = await Ticket.create({
      reference: await Ticket.generateReference(),
      requesterType: null,
      requesterId: null,
      guestName: data.guest_name,
      guestEmail: data.guest_email,
      guestToken: string.random(64),
      subject: data.subject,
      description: data.description,
      status: 'open',
      priority: (data.priority || config.defaultPriority) as TicketPriority,
      channel: 'web',
      departmentId: data.department_id || null,
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    const attachments = request.files('attachments')
    if (attachments && attachments.length > 0) {
      await this.attachmentService.storeMany('Ticket', ticket.id, attachments)
    }

    await emitter.emit(ESCALATED_EVENTS.TICKET_CREATED, { ticket })

    session.flash('success', 'Ticket created. Save this link to check your ticket status.')
    return response.redirect().toRoute('escalated.guest.tickets.show', { token: ticket.guestToken })
  }

  /**
   * GET /support/guest/:token — Show guest ticket
   */
  async show({ params, inertia }: HttpContext) {
    const ticket = await Ticket.query()
      .where('guest_token', params.token)
      .firstOrFail()

    await ticket.load('department')
    await ticket.load((loader: any) => {
      loader.load('replies', (query: any) => {
        query.where('is_internal_note', false).orderBy('created_at', 'desc')
      })
    })

    return inertia.render('Escalated/Guest/Show', {
      ticket,
      token: params.token,
    })
  }

  /**
   * POST /support/guest/:token/reply — Reply to guest ticket
   */
  async reply({ params, request, response, session }: HttpContext) {
    const ticket = await Ticket.query()
      .where('guest_token', params.token)
      .firstOrFail()

    if (ticket.status === 'closed') {
      session.flash('error', 'This ticket is closed.')
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

    session.flash('success', 'Reply sent.')
    return response.redirect().back()
  }
}
