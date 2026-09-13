/*
|--------------------------------------------------------------------------
| escalated:check-sla — CLI command
|--------------------------------------------------------------------------
|
| Flag every open ticket whose first-response or resolution target has passed,
| emitting `escalated:sla:breached` for each, then emit `escalated:sla:warning`
| for targets due within the warning window. A target passing is not an event
| anything else notices, so this is meant to run periodically from the host's
| scheduler/cron, like `escalated:run-escalations`.
|
|   node ace escalated:check-sla
|   node ace escalated:check-sla --warning-minutes=60
|
*/

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type SlaService from '../services/sla_service.js'

export default class CheckSlaCommand extends BaseCommand {
  static commandName = 'escalated:check-sla'

  static description = 'Flag SLA breaches and warn about SLA targets that are about to pass'

  static help = [
    'Check open tickets against their SLA targets:',
    '  node ace escalated:check-sla',
    '',
    'Warn about targets due within the next hour instead of 30 minutes:',
    '  node ace escalated:check-sla --warning-minutes=60',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.number({
    description: 'Warn about SLA targets due within this many minutes',
    default: 30,
  })
  declare warningMinutes: number

  async run() {
    const service = await this.makeService()

    this.logger.info('Checking SLA targets…')

    try {
      const breached = await service.checkBreaches()
      const warned = await service.checkWarnings(this.warningMinutes)

      if (breached === 0 && warned === 0) {
        this.logger.info('No SLA targets breached or about to breach.')
      } else {
        this.logger.success(
          `SLA check complete. ${breached} breach(es) flagged, ${warned} warning(s) emitted.`
        )
      }
    } catch (error: any) {
      this.logger.error(`SLA check failed: ${error.message}`)
      this.exitCode = 1
    }
  }

  /**
   * Build the SLA service. Resolved lazily, like the escalation command, so the
   * command module can be imported without booting the container.
   */
  protected async makeService(): Promise<SlaService> {
    const { default: SlaService } = await import('../services/sla_service.js')
    return new SlaService()
  }
}
