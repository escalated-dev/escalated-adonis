/*
|--------------------------------------------------------------------------
| Configure hook
|--------------------------------------------------------------------------
|
| The configure hook is called when someone runs "node ace configure"
| on this package. It copies the config file and migrations, and
| registers the provider.
|
*/

import ConfigureCommand from '@adonisjs/core/commands/configure'
import { stubsRoot } from './stubs/main.js'

export async function configure(command: ConfigureCommand) {
  /**
   * Publish config file
   */
  const codemods = await command.createCodemods()

  await codemods.makeUsingStub(stubsRoot, 'config/escalated.stub', {})

  /**
   * Register the provider
   */
  await codemods.updateRcFile((rcFile: any) => {
    rcFile.addProvider('@escalated-dev/escalated-adonis/providers/escalated_provider')
  })

  /**
   * Publish migrations
   */
  await command.publishMigrations({
    from: new URL('./database/migrations', import.meta.url),
    to: command.app.migrationsPath(),
  })

  command.logger.success('Escalated configured successfully!')
  command.logger.info('Run "node ace migration:run" to create the escalated tables.')
}
