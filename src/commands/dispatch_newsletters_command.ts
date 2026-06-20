/*
|--------------------------------------------------------------------------
| escalated:newsletters:dispatch — CLI command
|--------------------------------------------------------------------------
|
| Plan scheduled newsletters whose time has come and dispatch a batch of
| pending deliveries. Intended to run every minute with overlap protection
| at the scheduler level (withoutOverlapping / a mutex).
|
|   node ace escalated:newsletters:dispatch
|
*/

import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { DateTime } from 'luxon'
import { getConfig } from '../helpers/config.js'
import Newsletter from '../models/newsletter/newsletter.js'
import NewsletterDispatcher from '../services/newsletter/newsletter_dispatcher.js'
import NewsletterPlanner from '../services/newsletter/newsletter_planner.js'

let tickRunning = false

export default class DispatchNewslettersCommand extends BaseCommand {
  static commandName = 'escalated:newsletters:dispatch'

  static description =
    'Plan scheduled newsletters whose time has come and dispatch a batch of pending deliveries'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const config = getConfig() as {
      enableNewsletters?: boolean
      newsletters?: Record<string, unknown>
    }
    if (!config.enableNewsletters) {
      this.logger.info('Newsletter feature disabled — skipping.')
      return
    }

    if (tickRunning) {
      this.logger.warning('Previous newsletter dispatch tick is still running; skipping.')
      return
    }

    tickRunning = true
    try {
      const due = await Newsletter.query()
        .where('status', 'scheduled')
        .where('scheduled_at', '<=', DateTime.now().toSQL()!)

      const planner = new NewsletterPlanner()
      for (const newsletter of due) {
        this.logger.info(`Planning newsletter #${newsletter.id}`)
        await planner.plan(newsletter)
      }

      this.logger.info('Dispatching batch…')
      const dispatcher = new NewsletterDispatcher({
        enableNewsletters: true,
        batchSize: (config.newsletters as any)?.batchSize ?? 50,
        rateLimitPerMinute: (config.newsletters as any)?.rateLimitPerMinute ?? 60,
        claimTimeoutMinutes: (config.newsletters as any)?.claimTimeoutMinutes ?? 10,
        autoPauseBounceRate: (config.newsletters as any)?.autoPauseBounceRate ?? 0.05,
        autoPauseThreshold: (config.newsletters as any)?.autoPauseThreshold ?? 100,
        rendererOptions: {
          baseUrl: (config as any).appUrl ?? process.env.APP_URL ?? 'http://localhost',
          defaultTheme: (config.newsletters as any)?.defaultTheme ?? 'default',
          trackingEnabled: (config.newsletters as any)?.trackingEnabled !== false,
        },
      })
      await dispatcher.dispatchBatch()
      this.logger.success('Done.')
    } finally {
      tickRunning = false
    }
  }
}
