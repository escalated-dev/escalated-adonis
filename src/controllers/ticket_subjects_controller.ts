import type { HttpContext } from '@adonisjs/core/http'
import type Ticket from '../models/ticket.js'
import TicketSubjectLink from '../models/ticket_subject_link.js'
import TicketSubjectService, {
  assertTicketSubjectTypeAllowed,
  ticketSubjectAllowedTypes,
} from '../services/ticket_subject_service.js'

/**
 * Attach/detach host-app subject entities on a ticket. Types are resolved
 * strictly against `ticketSubjects.types` so request input cannot attach
 * arbitrary types when an allowlist is configured.
 */
export default class TicketSubjectsController {
  protected subjectService = new TicketSubjectService()

  /**
   * POST …/tickets/:ticket/subjects
   */
  async store(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const { type, id, role } = ctx.request.only(['type', 'id', 'role'])

    if (!type || typeof type !== 'string') {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { type: ['The type field is required.'] },
      })
    }

    if (id === undefined || id === null || id === '') {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { id: ['The id field is required.'] },
      })
    }

    const allowed = ticketSubjectAllowedTypes()
    if (allowed.length === 0 || !allowed.includes(type)) {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { type: [`Subject type [${type}] is not an allowed ticket subject.`] },
      })
    }

    try {
      assertTicketSubjectTypeAllowed(type)
    } catch {
      return ctx.response.unprocessableEntity({
        message: 'Validation failed.',
        errors: { type: [`Subject type [${type}] is not an allowed ticket subject.`] },
      })
    }

    await ticket.attachSubject(type, String(id), role ?? null)

    if (ctx.request.accepts(['html', 'json']) === 'json') {
      const subjects = await this.subjectService.serializeForTicket(ticket)
      return ctx.response.json({ subjects })
    }

    ctx.session.flash('success', 'Subject attached.')
    return ctx.response.redirect().back()
  }

  /**
   * DELETE …/tickets/:ticket/subjects/:subject
   */
  async destroy(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const linkId = Number(ctx.params.subject)

    if (Number.isNaN(linkId)) {
      return ctx.response.notFound({ message: 'Subject link not found.' })
    }

    const link = await TicketSubjectLink.query()
      .where('id', linkId)
      .where('ticket_id', ticket.id)
      .first()

    if (!link) {
      return ctx.response.notFound({ message: 'Subject link not found.' })
    }

    await link.delete()

    if (ctx.request.accepts(['html', 'json']) === 'json') {
      const subjects = await this.subjectService.serializeForTicket(ticket)
      return ctx.response.json({ subjects })
    }

    ctx.session.flash('success', 'Subject detached.')
    return ctx.response.redirect().back()
  }
}
