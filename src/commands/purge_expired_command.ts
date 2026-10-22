/*
|--------------------------------------------------------------------------
| escalated:purge-expired — CLI command
|--------------------------------------------------------------------------
|
| Apply the retention periods set on the admin Data Retention screen:
| soft-delete closed tickets older than their period (30-day grace), delete
| old attachments (with their files) and audit log entries, permanently
| remove tickets soft-deleted more than 30 days ago, and drop expired guest
| verification codes. Every period defaults to "never", which skips that
| kind of record. Run it daily from the host's scheduler/cron.
|
|   node ace escalated:purge-expired
|   node ace escalated:purge-expired --dry-run
|   node ace escalated:purge-expired --force
|
*/

import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class PurgeExpiredCommand extends BaseCommand {
  static commandName = 'escalated:purge-expired'

  static description = 'Purge expired data based on the configured retention policies'

  static help = [
    'Purge what the retention settings say has expired:',
    '  node ace escalated:purge-expired',
    '',
    'Show what would be purged without deleting anything:',
    '  node ace escalated:purge-expired --dry-run',
    '',
    'Delete expired closed tickets permanently instead of soft-deleting them:',
    '  node ace escalated:purge-expired --force',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.boolean({ description: 'Show what would be purged without deleting anything' })
  declare dryRun: boolean

  @flags.boolean({ description: 'Delete expired closed tickets permanently, not soft-delete' })
  declare force: boolean

  async run() {
    const { purgeExpired } = await import('../support/data_retention.js')

    try {
      await purgeExpired(
        { dryRun: this.dryRun, force: this.force },
        {
          info: (message) => this.logger.info(message),
          success: (message) => this.logger.success(message),
        }
      )
    } catch (error: any) {
      this.logger.error(`Purge failed: ${error.message}`)
      this.exitCode = 1
    }
  }
}
