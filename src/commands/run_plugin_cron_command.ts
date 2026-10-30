/*
|--------------------------------------------------------------------------
| escalated:plugins:cron — CLI command
|--------------------------------------------------------------------------
|
| Runs the cron schedules of SDK plugins that are due this minute (UTC).
| Schedule it every minute:
|
|   * * * * * node ace escalated:plugins:cron
|
*/

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class RunPluginCronCommand extends BaseCommand {
  static commandName = 'escalated:plugins:cron'

  static description = 'Run the due cron schedules of SDK plugins'

  static help = ['Run every minute, from cron or a scheduler:', '  node ace escalated:plugins:cron']

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({ description: 'The minute to run, as an ISO 8601 time (default: now)' })
  declare at?: string

  async run() {
    const minute = this.at === undefined ? new Date() : new Date(this.at)
    if (Number.isNaN(minute.getTime())) {
      this.logger.error('--at must be a time, such as 2026-10-29T09:00:00Z.')
      this.exitCode = 1
      return
    }

    const bridge = (globalThis as any).__escalated_pluginBridge
    const ran: number =
      typeof bridge?.runDueCron === 'function' ? await bridge.runDueCron(minute) : 0
    this.logger.info(`Ran ${ran} plugin cron schedule(s).`)
  }
}
