/*
|--------------------------------------------------------------------------
| escalated:run-escalations — CLI command
|--------------------------------------------------------------------------
|
| Evaluate all active escalation rules against open tickets and apply their
| actions. Escalation rules are time-based, so this command is meant to run
| periodically from the host's scheduler/cron — the same way automations are
| run via `escalated:run-automations`.
|
|   node ace escalated:run-escalations
|
*/

import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type EscalationService from '../services/escalation_service.js'

export default class RunEscalationsCommand extends BaseCommand {
  static commandName = 'escalated:run-escalations'

  static description = 'Evaluate all active escalation rules against open tickets'

  static help = ['Run all active escalation rules:', '  node ace escalated:run-escalations']

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const service = await this.makeService()

    this.logger.info('Evaluating escalation rules…')

    try {
      const escalated = await service.evaluateRules()

      if (escalated === 0) {
        this.logger.info('No tickets matched any escalation rule conditions.')
      } else {
        this.logger.success(`Escalation evaluation complete. ${escalated} ticket(s) escalated.`)
      }
    } catch (error: any) {
      this.logger.error(`Escalation run failed: ${error.message}`)
      this.exitCode = 1
    }
  }

  /**
   * Build the escalation service. Resolved lazily (mirroring the provider) so
   * the command module can be imported without booting the container, and so
   * tests can override this seam to inject a fake service.
   */
  protected async makeService(): Promise<EscalationService> {
    const { default: EscalationService } = await import('../services/escalation_service.js')
    return new EscalationService()
  }
}
