/*
|--------------------------------------------------------------------------
| Commands index
|--------------------------------------------------------------------------
|
| Writes src/commands/commands.json, the index the commands loader
| (src/commands/main.ts) reads to list this package's Ace commands.
|
|   npm run index:commands               write the index
|   npm run index:commands -- --check    exit 1 if the committed index is stale
|
*/

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'
import { IgnitorFactory } from '@adonisjs/core/factories'
import { FsLoader } from '@adonisjs/core/ace'

const ROOT = new URL('../', import.meta.url)
const COMMANDS_DIR = fileURLToPath(new URL('src/commands/', ROOT))
const INDEX_FILE = join(COMMANDS_DIR, 'commands.json')

// Command modules import Adonis services, which expect an application to
// exist. It is created but never booted: a booted one would resolve those
// services' container bindings, which reading command metadata does not need.
new IgnitorFactory().withCoreConfig().withCoreProviders().create(ROOT).createApp('console')

const commands = await new FsLoader(COMMANDS_DIR, (file) => file !== 'main.js').getMetaData()
commands.sort((a, b) => a.commandName.localeCompare(b.commandName))

const prettierOptions = (await prettier.resolveConfig(INDEX_FILE)) ?? {}
const index = await prettier.format(JSON.stringify({ commands, version: 1 }), {
  ...prettierOptions,
  filepath: INDEX_FILE,
})

if (process.argv.includes('--check')) {
  const committed = await readFile(INDEX_FILE, 'utf8').catch(() => '')
  if (committed.replace(/\r\n/g, '\n') !== index) {
    console.error(
      'src/commands/commands.json does not match the command classes. ' +
        'Run "npm run index:commands" and commit the result.'
    )
    process.exitCode = 1
  }
} else {
  await writeFile(INDEX_FILE, index)
  console.log(`Wrote ${commands.length} commands to src/commands/commands.json`)
}
