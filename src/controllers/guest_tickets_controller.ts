import type { HttpContext } from '@adonisjs/core/http'
import { signAttachments } from '../support/attachment_access.js'
import emitter from '@adonisjs/core/services/emitter'
import type Ticket from '../models/ticket.js'
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
import {
  InvalidCode,
  consume,
  isValidEmail,
  issue,
  markVerified,
  normalizeEmail,
  privateResponse,
  ticketForToken,
} from '../support/guest_access.js'
import { proofErrors } from './guest_verification_controller.js'

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
      // The shared page's email-code and lookup flows (docs/guest-access.md).
      verification_url: guestUrl('verification'),
      lookup_url: guestUrl('lookup'),
    })
  }

  /**
   * POST /support/guest — Store guest ticket
   */
  async store(ctx: HttpContext) {
    const { request, response, session } = ctx
    if (!(await EscalatedSetting.guestTicketsEnabled())) {
      return response.notFound()
    }

    const data = request.only([
      'guest_name',
      'guest_email',
      'name',
      'email',
      'subject',
      'description',
      'priority',
      'department_id',
      'verification_id',
      'verification_code',
    ])
    // The shared page posts guest_name/guest_email; earlier forms name/email.
    const name =
      typeof (data.guest_name ?? data.name) === 'string' ? (data.guest_name ?? data.name) : null
    const email = normalizeEmail(data.guest_email ?? data.email)

    const errors: Record<string, string> = {}
    if (!isValidEmail(email)) errors.guest_email = 'Enter a valid email address.'
    if (typeof data.subject !== 'string' || data.subject.trim() === '') {
      errors.subject = 'The subject field is required.'
    }
    if (typeof data.description !== 'string' || data.description.trim() === '') {
      errors.description = 'The description field is required.'
    }
    Object.assign(errors, proofErrors(data))
    if (Object.keys(errors).length > 0) return backWithErrors(ctx, errors)

    let token: string
    try {
      token = await consume(
        data.verification_id,
        data.verification_code,
        email,
        'ticket',
        async () => {
          const ticket = await this.ticketService.createGuest({
            name,
            email,
            subject: data.subject,
            description: data.description,
            priority: data.priority,
            channel: 'web',
            departmentId: data.department_id || null,
            attachments: request.files('attachments'),
            verified: true,
          })
          return issue(ticket)
        }
      )
    } catch (error) {
      if (error instanceof InvalidCode) {
        return backWithErrors(ctx, { verification_code: error.message })
      }
      throw error
    }

    session.flash('success', t('guest.created'))
    privateResponse(response)
    return redirectToRoute(response, 'escalated.guest.tickets.show', { token })
  }

  /**
   * GET /support/guest/:token — Show guest ticket
   */
  async show(ctx: HttpContext) {
    const ticket = await ticketForToken(ctx.params.token)
    if (!ticket) return ctx.response.notFound()

    await ticket.load('department')
    await ticket.load((loader: any) => {
      loader.load('replies', (query: any) => {
        query.preload('attachments').where('is_internal_note', false).orderBy('created_at', 'desc')
      })
    })

    // Short-lived links to the access-checked download route.
    await ticket.load('attachments')
    await signAttachments([ticket, ...(ticket.replies ?? [])], { guestTicket: ticket })

    privateResponse(ctx.response)
    return getRenderer().render(ctx, 'Escalated/Guest/Show', {
      ticket: guestTicketPayload(ticket),
      token: ctx.params.token,
    })
  }

  /**
   * POST /support/guest/:token/reply — Reply to guest ticket
   */
  async reply({ params, request, response, session }: HttpContext) {
    const ticket = await ticketForToken(params.token)
    if (!ticket) return response.notFound()

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

/** The guest surface's URL for `action`, under the configured route prefix. */
function guestUrl(action: 'verification' | 'lookup'): string {
  const prefix = String(getConfig().routes?.prefix ?? 'support').replace(/^\/+|\/+$/g, '')
  return `${prefix ? `/${prefix}` : ''}/guest/${action}`
}

/** An Inertia form visit reads errors from the session, as a VineJS failure leaves them. */
function backWithErrors(ctx: HttpContext, errors: Record<string, string>) {
  const messages = Object.entries(errors).map(([field, message]) => ({ field, message }))
  ctx.session.flashValidationErrors({ code: 'E_VALIDATION_ERROR', messages } as any)
  return ctx.response.redirect().back()
}

/**
 * What the guest page may see: the ticket without host metadata, chat
 * metadata or the requester record, and replies without metadata.
 */
function guestTicketPayload(ticket: Ticket) {
  const payload: Record<string, any> = ticket.serialize()
  for (const key of [
    'metadata',
    'chat_metadata',
    'guest_token',
    'requester_type',
    'requester_id',
  ]) {
    delete payload[key]
  }
  if (Array.isArray(payload.replies)) {
    payload.replies = payload.replies.map((reply: Record<string, any>) => {
      const rest = { ...reply }
      delete rest.metadata
      return rest
    })
  }
  return payload
}
