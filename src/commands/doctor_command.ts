/*
|--------------------------------------------------------------------------
| escalated:doctor — CLI command
|--------------------------------------------------------------------------
|
| Checks what an install needs before staff can use Escalated: the
| authorization.isAgent / isAdmin gates, a user model whose users have an
| `id`, and whether the recurring jobs (escalated:check-sla and friends) are
| scheduled. Exits 1 when a gate or the user model is missing; recurring jobs
| that are not running yet are a warning.
|
|   node ace escalated:doctor
|   node ace escalated:doctor --json
|
*/

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class DoctorCommand extends BaseCommand {
  static commandName = 'escalated:doctor'

  static description =
    'Check the Escalated setup: staff gates, the user model and the recurring jobs'

  static help = [
    'Report what is missing from the Escalated setup:',
    '  node ace escalated:doctor',
    '',
    'The same report as JSON (includes the `scheduler` status):',
    '  node ace escalated:doctor --json',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Print the report as JSON' })
  declare json: boolean

  async run() {
    const { runSetupChecks } = await import('../support/setup_checks.js')
    const report = await runSetupChecks()

    if (this.json) {
      this.logger.log(JSON.stringify(report, null, 2))
    } else {
      for (const check of report.checks) {
        const line = `${check.name}: ${check.message}`
        if (check.status === 'ok') this.logger.success(line)
        else if (check.status === 'warning') this.logger.warning(line)
        else this.logger.error(line)
      }
    }

    if (!report.ok) {
      this.exitCode = 1
    }
  }
}
