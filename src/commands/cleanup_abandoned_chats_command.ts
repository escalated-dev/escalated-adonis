/*
|--------------------------------------------------------------------------
| escalated:cleanup-abandoned-chats — CLI command
|--------------------------------------------------------------------------
|
| Marks chat sessions that have been waiting in the queue without
| being accepted as "abandoned" and closes the associated ticket.
|
|   node ace escalated:cleanup-abandoned-chats
|   node ace escalated:cleanup-abandoned-chats --minutes=15
|
*/

import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import ChatSession from '../models/chat_session.js'
import Ticket from '../models/ticket.js'

export default class CleanupAbandonedChatsCommand extends BaseCommand {
  static commandName = 'escalated:cleanup-abandoned-chats'

  static description = 'Clean up chat sessions abandoned in the queue'

  static help = [
    'Mark waiting chat sessions older than N minutes as abandoned:',
    '  node ace escalated:cleanup-abandoned-chats --minutes=15',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Abandon threshold in minutes', required: false })
  declare minutesArg: string

  async run() {
    const minutes = Number.parseInt(this.minutesArg || '15', 10)

    this.logger.info(
      `Checking for chat sessions waiting in queue for more than ${minutes} minutes...`
    )

    try {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString()

      const abandonedSessions = await ChatSession.query()
        .where('status', 'waiting')
        .where('created_at', '<', cutoff)

      if (abandonedSessions.length === 0) {
        this.logger.info('No abandoned chat sessions found.')
        return
      }

      let cleaned = 0
      for (const session of abandonedSessions) {
        session.status = 'abandoned'
        session.endedAt = DateTime.now()
        await session.save()

        // Close the associated ticket
        const ticket = await Ticket.find(session.ticketId)
        if (ticket && !['resolved', 'closed'].includes(ticket.status)) {
          ticket.status = 'closed'
          ticket.closedAt = DateTime.now()
          ticket.chatEndedAt = DateTime.now()
          await ticket.save()
        }

        cleaned++
      }

      this.logger.success(`Cleaned up ${cleaned} abandoned chat session(s).`)
    } catch (error: any) {
      this.logger.error(`Failed to clean up abandoned chats: ${error.message}`)
      this.exitCode = 1
    }
  }
}
