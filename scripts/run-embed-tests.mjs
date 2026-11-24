/*
 * Runs the specs that boot the integration application with a configuration
 * of their own, one process per file: the embedded-admin specs (tests/embed)
 * and the others (tests/isolated), such as installs with optional routes off.
 *
 * Routes are registered at boot, and Adonis services bind to the first
 * application a process boots, so these cannot share a process with each
 * other or with tests/integration. Runs them one after another.
 */
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const files = ['embed', 'isolated'].flatMap((dir) =>
  readdirSync(new URL(`../tests/${dir}/`, import.meta.url))
    .filter((file) => file.endsWith('.spec.ts'))
    .sort()
    .map((file) => `tests/${dir}/${file}`)
)

for (const file of files) {
  console.log(`
# ${file}`)
  const result = spawnSync(process.execPath, ['--import=tsx', 'bin/test.ts', `--files=${file}`], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ESCALATED_TEST_SUITE: 'embed' },
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
