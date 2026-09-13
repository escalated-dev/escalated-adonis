import { test } from '@japa/runner'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DateTime } from 'luxon'
import { testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Ace commands
|--------------------------------------------------------------------------
|
| A host loads a package's commands through a loader module named in its
| adonisrc `commands` array, which ace calls `getMetaData()` and `getCommand()`
| on. This package exported its command classes but no such loader, and
| `configure` never registered one, so none of its commands could run: no
| escalations, automations, snooze wake-ups, newsletter dispatch or chat
| cleanup ever happened in a real host.
|
| The test application registers the loader in its rcFile the way a host's
| adonisrc does, and runs commands through ace's own kernel.
|
*/

const ROOT = new URL('../../', import.meta.url)
const LOADER_SPECIFIER = '@escalated-dev/escalated-adonis/commands'

test.group('Ace commands', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(60_000)

  async function kernel() {
    const ace = await running.app.container.make('ace')
    ace.ui.switchMode('raw')
    await ace.boot()
    return ace
  }

  function logs(ace: { ui: { logger: { getLogs(): Array<{ message: string }> } } }) {
    return ace.ui.logger.getLogs().map((log) => log.message)
  }

  // ---- Loading ----------------------------------------------------------------

  test('ace runs a package command through the loader the rcFile registers', async ({ assert }) => {
    const ace = await kernel()

    const command = await ace.exec('escalated:run-escalations', [])

    assert.equal(command.exitCode, 0, JSON.stringify(logs(ace)))
    assert.isTrue(logs(ace).some((message) => message.includes('Evaluating escalation rules')))
  })

  test('the commands index describes every command class in src/commands', async ({ assert }) => {
    // `npm run index:commands` writes the index; `--check` rebuilds it in memory
    // and fails when the committed file differs. It runs in a process of its own:
    // importing every command module resolves the services they use once an
    // application has booted, and this one has not registered all of them (mail).
    const result = spawnSync(
      process.execPath,
      ['--import=tsx', 'scripts/index_commands.ts', '--check'],
      { cwd: fileURLToPath(ROOT), encoding: 'utf8' }
    )

    // Stack lines in the child's output would confuse the error printer.
    const output = `${result.stdout}${result.stderr}`
      .split(/\r?\n/)
      .filter((line) => !/^\s*at /.test(line))
      .join(' | ')
    assert.equal(result.status, 0, output)
  })

  test('every command the README tells hosts to run is registered under that name', async ({
    assert,
  }) => {
    const readme = readFileSync(new URL('README.md', ROOT), 'utf8')
    const documented = [
      ...new Set([...readme.matchAll(/node ace (escalated:[\w:-]+)/g)].map((match) => match[1])),
    ]
    const ace = await kernel()

    assert.isNotEmpty(documented)
    for (const name of documented) {
      assert.exists(ace.getCommand(name), `the README documents ${name}, which is not registered`)
    }
  })

  // ---- Installing -------------------------------------------------------------

  test('configure registers the commands loader alongside the provider', async ({
    assert,
    cleanup,
  }) => {
    const { configure } = await import('../../configure.js')
    const migrations = mkdtempSync(join(tmpdir(), 'escalated-configure-'))
    cleanup(() => rmSync(migrations, { recursive: true, force: true }))

    const rcFile = {
      providers: [] as string[],
      commands: [] as string[],
      addProvider(path: string) {
        this.providers.push(path)
        return this
      },
      addCommand(path: string) {
        this.commands.push(path)
        return this
      },
    }
    const command: any = {
      app: { migrationsPath: () => migrations },
      parsedFlags: {},
      logger: { success() {}, info() {}, action: () => ({ succeeded() {} }) },
      createCodemods: async () => ({
        makeUsingStub: async () => {},
        updateRcFile: async (callback: (file: typeof rcFile) => void) => callback(rcFile),
      }),
    }

    await configure(command)

    assert.include(rcFile.providers, '@escalated-dev/escalated-adonis/providers/escalated_provider')
    assert.include(rcFile.commands, LOADER_SPECIFIER)
  })

  test('the package exports the loader at the path configure registers', async ({ assert }) => {
    const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'))

    assert.equal(`${pkg.name}/commands`, LOADER_SPECIFIER)
    assert.equal(pkg.exports['./commands'], './build/src/commands/main.js')
  })

  test('the build ships the loader next to its index', async ({ assert }) => {
    assert.isTrue(existsSync(new URL('build/src/commands/main.js', ROOT)))
    assert.isTrue(existsSync(new URL('build/src/commands/commands.json', ROOT)))
  }).skip(!existsSync(new URL('build/', ROOT)), 'no build output: run `npm run build` first')

  // ---- SLA ----------------------------------------------------------------------

  test('escalated:check-sla emits a breach for an overdue ticket and a warning for one about to breach', async ({
    assert,
    cleanup,
  }) => {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    const { default: emitter } = await import('@adonisjs/core/services/emitter')

    const ticket = (reference: string, subject: string, dueDates: Record<string, DateTime>) =>
      Ticket.create({
        reference: `${reference}-${Date.now()}`,
        requesterType: 'User',
        requesterId: TEST_USERS.customer.id,
        subject,
        description: 'SLA command test',
        status: 'open',
        priority: 'high',
        ticketType: 'question',
        channel: 'web',
        slaFirstResponseBreached: false,
        slaResolutionBreached: false,
        ...dueDates,
      } as any)

    const overdue = await ticket('SLA-OVERDUE', 'First response overdue', {
      firstResponseDueAt: DateTime.now().minus({ hours: 1 }),
    })
    const dueSoon = await ticket('SLA-SOON', 'Resolution due soon', {
      resolutionDueAt: DateTime.now().plus({ minutes: 10 }),
    })

    const breaches: Array<{ id: number; type: string }> = []
    const warnings: Array<{ id: number; type: string }> = []
    const onBreach = (data: any) => breaches.push({ id: data.ticket.id, type: data.type })
    const onWarning = (data: any) => warnings.push({ id: data.ticket.id, type: data.type })
    emitter.on(ESCALATED_EVENTS.SLA_BREACHED, onBreach)
    emitter.on(ESCALATED_EVENTS.SLA_WARNING, onWarning)
    cleanup(() => {
      emitter.off(ESCALATED_EVENTS.SLA_BREACHED, onBreach)
      emitter.off(ESCALATED_EVENTS.SLA_WARNING, onWarning)
    })

    const ace = await kernel()
    const command = await ace.exec('escalated:check-sla', [])

    assert.equal(command.exitCode, 0, JSON.stringify(logs(ace)))
    assert.deepInclude(breaches, { id: overdue.id, type: 'first_response' })
    assert.deepInclude(warnings, { id: dueSoon.id, type: 'resolution' })
    assert.notDeepInclude(warnings, { id: overdue.id, type: 'first_response' })

    const overdueAfter = await Ticket.findOrFail(overdue.id)
    assert.isTrue(Boolean(overdueAfter.slaFirstResponseBreached))
  })
})
