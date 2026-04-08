/*
|--------------------------------------------------------------------------
| escalated:wake-snoozed-tickets — CLI command
|--------------------------------------------------------------------------
|
| Unsnooze all tickets whose snoozed_until has passed, restoring
| their previous status.
|
|   node ace escalated:wake-snoozed-tickets
|
*/

import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Ticket from '../models/ticket.js'
import TicketService from '../services/ticket_service.js'

export default class WakeSnoozedTicketsCommand extends BaseCommand {
  static commandName = 'escalated:wake-snoozed-tickets'

  static description = 'Unsnooze tickets whose snooze period has elapsed'

  static help = [
    'Wake all snoozed tickets that are past their snoozed_until time:',
    '  node ace escalated:wake-snoozed-tickets',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const ticketService = new TicketService()

    this.logger.info('Checking for snoozed tickets to wake…')

    try {
      const tickets = await Ticket.query().withScopes((scopes) => scopes.awakeDue())

      if (tickets.length === 0) {
        this.logger.info('No snoozed tickets to wake.')
        return
      }

      let woken = 0
      for (const ticket of tickets) {
        await ticketService.unsnoozeTicket(ticket)
        woken++
      }

      this.logger.success(`Woke ${woken} snoozed ticket(s).`)
    } catch (error: any) {
      this.logger.error(`Failed to wake snoozed tickets: ${error.message}`)
      this.exitCode = 1
    }
  }
}
