import Macro from '../models/macro.js'
import Ticket from '../models/ticket.js'
import TicketService from './ticket_service.js'
import AssignmentService from './assignment_service.js'
import type { TicketStatus, TicketPriority } from '../types.js'

export default class MacroService {
  constructor(
    protected ticketService: TicketService = new TicketService(),
    protected assignmentService: AssignmentService = new AssignmentService()
  ) {}

  /**
   * Apply a macro's actions to a ticket.
   */
  async apply(
    macro: Macro,
    ticket: Ticket,
    causer: any
  ): Promise<Ticket> {
    for (const action of macro.actions) {
      const type = action.type
      const value = action.value

      switch (type) {
        case 'status':
          await this.ticketService.changeStatus(ticket, value as TicketStatus, causer)
          break
        case 'priority':
          await this.ticketService.changePriority(ticket, value as TicketPriority, causer)
          break
        case 'assign':
          await this.assignmentService.assign(ticket, Number(value), causer)
          break
        case 'tags':
          await this.ticketService.addTags(ticket, Array.isArray(value) ? value : [value], causer)
          break
        case 'department':
          await this.ticketService.changeDepartment(ticket, Number(value), causer)
          break
        case 'reply':
          await this.ticketService.reply(ticket, causer, value as string)
          break
        case 'note':
          await this.ticketService.addNote(ticket, causer, value as string)
          break
      }

      await ticket.refresh()
    }

    return ticket
  }
}
