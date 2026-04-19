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

import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type ConfigureCommand from '@adonisjs/core/commands/configure'
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
   *
   * AdonisJS 6 removed `command.publishMigrations`. Replicate its behaviour
   * with `node:fs/promises`: copy every shipped migration into the host
   * app's `database/migrations/` directory with a unique timestamp prefix so
   * the migrator runs them after the host's own migrations.
   *
   * Idempotent: if a file ending in `_<basename>` already exists in the
   * target directory, skip it (unless `--force`).
   */
  await publishMigrations(command)

  command.logger.success('Escalated configured successfully!')
  command.logger.info('Run "node ace migration:run" to create the escalated tables.')
}

async function publishMigrations(command: ConfigureCommand): Promise<void> {
  const sourceDir = fileURLToPath(new URL('./database/migrations', import.meta.url))
  const targetDir = command.app.migrationsPath()

  await mkdir(targetDir, { recursive: true })

  const sourceEntries = await readdir(sourceDir)
  const sourceFiles = sourceEntries.filter((name) => name.endsWith('.ts')).sort()

  const targetEntries = await readdir(targetDir).catch((): string[] => [])
  const existing = new Set(targetEntries.filter((name) => name.endsWith('.ts')))

  const force = !!command.parsedFlags.force
  const baseTimestamp = Date.now()

  let offset = 0
  for (const sourceName of sourceFiles) {
    const cleanBasename = sourceName.replace(/^\d+_/, '')

    if (!force) {
      const alreadyPublished = [...existing].some((name) => name.endsWith(`_${cleanBasename}`))
      if (alreadyPublished) {
        command.logger.info(`skip ${cleanBasename} (already published)`)
        offset += 1
        continue
      }
    }

    const targetName = `${baseTimestamp + offset}_${cleanBasename}`
    await copyFile(join(sourceDir, sourceName), join(targetDir, targetName))
    command.logger.action(`create database/migrations/${targetName}`).succeeded()
    offset += 1
  }
}
