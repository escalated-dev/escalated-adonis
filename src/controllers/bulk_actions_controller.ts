import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../models/ticket.js'
import TicketService from '../services/ticket_service.js'
import AssignmentService from '../services/assignment_service.js'
import type { TicketStatus, TicketPriority } from '../types.js'
import { t } from '../support/i18n.js'

export default class BulkActionsController {
  protected ticketService = new TicketService()
  protected assignmentService = new AssignmentService()

  /**
   * POST /support/agent/tickets/bulk or /support/admin/tickets/bulk
   */
  async handle({ request, auth, response, session }: HttpContext) {
    const { ticket_ids, action, value } = request.only(['ticket_ids', 'action', 'value'])
    const causer = auth.user!
    let successCount = 0

    const tickets = await Ticket.query().whereIn('id', ticket_ids)

    for (const ticket of tickets) {
      try {
        switch (action) {
          case 'status':
            await this.ticketService.changeStatus(ticket, value as TicketStatus, causer as any)
            break
          case 'priority':
            await this.ticketService.changePriority(ticket, value as TicketPriority, causer as any)
            break
          case 'assign':
            await this.assignmentService.assign(ticket, Number(value), causer as any)
            break
          case 'tags':
            await this.ticketService.addTags(ticket, Array.isArray(value) ? value : [value], causer as any)
            break
          case 'department':
            await this.ticketService.changeDepartment(ticket, Number(value), causer as any)
            break
          case 'delete':
            await ticket.delete()
            break
        }
        successCount++
      } catch {
        // Skip tickets that fail (e.g. invalid status transitions)
      }
    }

    session.flash('success', t('bulk.updated', { count: successCount }))
    return response.redirect().back()
  }
}
