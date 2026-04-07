/*
|--------------------------------------------------------------------------
| escalated:run-automations — CLI command
|--------------------------------------------------------------------------
|
| Evaluate all active automations against open tickets.
|
|   node ace escalated:run-automations
|
*/

import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import AutomationRunner from '../services/automation_runner.js'

export default class RunAutomationsCommand extends BaseCommand {
  static commandName = 'escalated:run-automations'

  static description = 'Evaluate all active automations against open tickets'

  static help = ['Run all active automations:', '  node ace escalated:run-automations']

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const runner = new AutomationRunner()

    this.logger.info('Running automations…')

    try {
      const affected = await runner.run()

      if (affected === 0) {
        this.logger.info('No tickets matched any automation conditions.')
      } else {
        this.logger.success(`Automations complete. ${affected} ticket(s) affected.`)
      }
    } catch (error: any) {
      this.logger.error(`Automation run failed: ${error.message}`)
      this.exitCode = 1
    }
  }
}
