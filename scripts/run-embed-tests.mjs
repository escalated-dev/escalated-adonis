/*
 * Runs the embedded-admin specs (tests/embed), one process per file.
 *
 * Each spec boots the integration application with its own `ui.embed`
 * configuration (routes are registered at boot, and Adonis services bind to
 * the first application a process boots), so they cannot share a process
 * with each other or with tests/integration. Runs them one after another.
 */
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const files = readdirSync(new URL('../tests/embed/', import.meta.url))
  .filter((file) => file.endsWith('.spec.ts'))
  .sort()

for (const file of files) {
  console.log(`\n# tests/embed/${file}`)
  const result = spawnSync(
    process.execPath,
    ['--import=tsx', 'bin/test.ts', `--files=tests/embed/${file}`],
    { cwd: root, stdio: 'inherit', env: { ...process.env, ESCALATED_TEST_SUITE: 'embed' } }
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
