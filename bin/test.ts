import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))

configure({
  files: ['tests/newsletter/**/*.spec.ts', 'tests/escalation/**/*.spec.ts'],
  plugins: [assert()],
})

await run()
