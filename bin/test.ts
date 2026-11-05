import { assert } from '@japa/assert'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))

configure({
  // The embedded-admin specs boot an application with their own config, one
  // process per file (scripts/run-embed-tests.mjs sets ESCALATED_TEST_SUITE).
  files:
    process.env.ESCALATED_TEST_SUITE === 'embed'
      ? ['tests/embed/**/*.spec.ts']
      : [
          'tests/newsletter/**/*.spec.ts',
          'tests/escalation/**/*.spec.ts',
          'tests/integration/**/*.spec.ts',
        ],
  plugins: [assert()],
  teardown: [
    async () => {
      // Integration specs share one booted application; stop it so the run can exit.
      const { closeTestApp } = await import('../tests/integration/helpers/app.js')
      await closeTestApp()
    },
  ],
})

await run()
