/*
|--------------------------------------------------------------------------
| escalated:close-idle-chats — CLI command
|--------------------------------------------------------------------------
|
| Closes chat sessions that have been idle (no activity) for longer
| than the configured threshold.
|
|   node ace escalated:close-idle-chats
|   node ace escalated:close-idle-chats --minutes=30
|
*/

import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import ChatSession from '../models/chat_session.js'
import ChatSessionService from '../services/chat_session_service.js'

export default class CloseIdleChatsCommand extends BaseCommand {
  static commandName = 'escalated:close-idle-chats'

  static description = 'Close chat sessions that have been idle beyond the threshold'

  static help = [
    'Close all active chat sessions that have had no activity for N minutes:',
    '  node ace escalated:close-idle-chats --minutes=30',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Idle threshold in minutes', required: false })
  declare minutesArg: string

  async run() {
    const minutes = Number.parseInt(this.minutesArg || '30', 10)
    const chatService = new ChatSessionService()

    this.logger.info(`Checking for chat sessions idle for more than ${minutes} minutes...`)

    try {
      const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString()

      const idleSessions = await ChatSession.query()
        .where('status', 'active')
        .where('last_activity_at', '<', cutoff)

      if (idleSessions.length === 0) {
        this.logger.info('No idle chat sessions found.')
        return
      }

      let closed = 0
      for (const session of idleSessions) {
        await chatService.endChat(session.id)
        closed++
      }

      this.logger.success(`Closed ${closed} idle chat session(s).`)
    } catch (error: any) {
      this.logger.error(`Failed to close idle chats: ${error.message}`)
      this.exitCode = 1
    }
  }
}
