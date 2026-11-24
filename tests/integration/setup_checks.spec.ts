import { test } from '@japa/runner'
import { testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'

/*
|--------------------------------------------------------------------------
| Setup errors: staff gates and the user contract
|--------------------------------------------------------------------------
|
| A host that has not set up authorization.isAgent / isAdmin, or whose
| signed-in user has no `id` (EscalatedAuthUser), got a bare 403 or a raw
| TypeError / database error on the first staff action. These name what is
| missing, and `node ace escalated:doctor` reports it.
|
*/

function fakeCtx(user: unknown) {
  const answer: { status?: number; body?: any } = {}
  const warnings: string[] = []
  const ctx: any = {
    auth: { user },
    logger: { warn: (message: string) => warnings.push(message) },
    response: {
      forbidden: (body: any) => {
        answer.status = 403
        answer.body = body
        return answer
      },
    },
  }
  return { ctx, answer, warnings }
}

test.group('Setup errors', (group) => {
  let running: TestApp
  let authorization: any

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(60_000)

  group.each.setup(() => {
    const config = getConfig() as any
    authorization = config.authorization
    return () => {
      config.authorization = authorization
    }
  })

  function setAuthorization(value: any) {
    ;(getConfig() as any).authorization = value
  }

  // ---- The user contract ----------------------------------------------------

  test('a staff user without an id fails with an error naming EscalatedAuthUser', async ({
    assert,
  }) => {
    const { default: EnsureIsAgent } = await import('../../src/middleware/ensure_is_agent.js')
    const { default: EnsureIsAdmin } = await import('../../src/middleware/ensure_is_admin.js')
    const { EscalatedUserContractError } = await import('../../src/support/auth_user.js')
    setAuthorization({ isAgent: () => true, isAdmin: () => true })

    class Account {
      email = 'staff@example.test'
    }

    for (const Middleware of [EnsureIsAgent, EnsureIsAdmin]) {
      const { ctx } = fakeCtx(new Account())
      let nextCalled = false
      const error = await new Middleware()
        .handle(ctx, async () => {
          nextCalled = true
        })
        .then(
          () => null,
          (thrown: unknown) => thrown
        )

      assert.instanceOf(error, EscalatedUserContractError)
      assert.include((error as Error).message, 'Account')
      assert.include((error as Error).message, 'EscalatedAuthUser')
      assert.include((error as Error).message, 'config.userModel')
      assert.include((error as Error).message, '`id`')
      assert.equal((error as any).status, 500)
      assert.isFalse(nextCalled)
    }
  })

  test('requireAuthUser names the contract instead of returning a user without an id', async ({
    assert,
  }) => {
    const { requireAuthUser, EscalatedUserContractError } = await import(
      '../../src/support/auth_user.js'
    )
    assert.throws(() => requireAuthUser({ user: { name: 'No id' } }), EscalatedUserContractError)
    assert.throws(() => requireAuthUser({ user: { id: '' } }), /EscalatedAuthUser/)
    assert.equal(requireAuthUser({ user: TEST_USERS.agent }).id, TEST_USERS.agent.id)
    // String ids (UUID users) satisfy it.
    assert.equal(requireAuthUser({ user: { id: 'a1b2' } }).id, 'a1b2')
  })

  test('a staff user with an id passes', async ({ assert }) => {
    const { default: EnsureIsAgent } = await import('../../src/middleware/ensure_is_agent.js')
    const { ctx, answer } = fakeCtx(TEST_USERS.agent)
    let nextCalled = false
    await new EnsureIsAgent().handle(ctx, async () => {
      nextCalled = true
    })
    assert.isTrue(nextCalled)
    assert.isUndefined(answer.status)
  })

  // ---- Missing gates --------------------------------------------------------

  test('with no gates configured, the 403 names the missing settings', async ({ assert }) => {
    const { default: EnsureIsAgent } = await import('../../src/middleware/ensure_is_agent.js')
    const { default: EnsureIsAdmin } = await import('../../src/middleware/ensure_is_admin.js')
    setAuthorization(undefined)

    const agent = fakeCtx(TEST_USERS.agent)
    await new EnsureIsAgent().handle(agent.ctx, async () => {})
    assert.equal(agent.answer.status, 403)
    assert.include(agent.answer.body.error, 'authorization.isAgent and authorization.isAdmin')
    assert.include(agent.answer.body.error, 'config/escalated.ts')
    assert.lengthOf(agent.warnings, 1)

    const admin = fakeCtx(TEST_USERS.admin)
    await new EnsureIsAdmin().handle(admin.ctx, async () => {})
    assert.equal(admin.answer.status, 403)
    assert.include(admin.answer.body.error, 'authorization.isAdmin')
  })

  test('a configured gate that says no keeps the plain 403', async ({ assert }) => {
    const { default: EnsureIsAgent } = await import('../../src/middleware/ensure_is_agent.js')
    const { ctx, answer } = fakeCtx(TEST_USERS.customer)
    await new EnsureIsAgent().handle(ctx, async () => {})
    assert.equal(answer.status, 403)
    assert.notInclude(answer.body.error, 'authorization.isAgent')
  })

  test('a missing gate is "no" instead of a TypeError in the agent panel', async ({ assert }) => {
    const { isStaff } = await import('../../src/services/agent_panel.js')
    setAuthorization({ isAdmin: (user: any) => user.role === 'admin' })
    assert.isFalse(await isStaff(TEST_USERS.agent))
    assert.isTrue(await isStaff(TEST_USERS.admin))
  })

  // ---- escalated:doctor ----------------------------------------------------

  async function doctor(args: string[] = []) {
    const ace = await running.app.container.make('ace')
    ace.ui.switchMode('raw')
    await ace.boot()
    const command = await ace.exec('escalated:doctor', args)
    const logs = ace.ui.logger.getLogs().map((log: { message: string }) => log.message)
    return { command, logs }
  }

  test('escalated:doctor passes a working setup', async ({ assert }) => {
    const { command, logs } = await doctor(['--json'])
    assert.equal(command.exitCode, 0, logs.join('\n'))
    const report = JSON.parse(logs.join('\n'))
    assert.isTrue(report.ok)
    assert.deepEqual(
      report.checks.map((check: any) => [check.name, check.status]).slice(0, 2),
      [
        ['staff_gates', 'ok'],
        ['user_model', 'ok'],
      ]
    )
    assert.equal(report.checks[2].name, 'recurring_jobs')
    assert.isArray(report.scheduler.commands)
  })

  test('escalated:doctor reports missing gates and fails', async ({ assert }) => {
    setAuthorization({})
    const { command, logs } = await doctor()
    assert.equal(command.exitCode, 1)
    assert.isTrue(
      logs.some((line: string) =>
        line.includes('authorization.isAgent and authorization.isAdmin are not configured')
      ),
      logs.join('\n')
    )
  })

  test('the user model check reports a model whose users have no id', async ({ assert }) => {
    const { checkUserModel } = await import('../../src/support/setup_checks.js')

    class Member {
      static primaryKey = 'memberUuid'
      static boot() {}
      static $hasColumn(name: string) {
        return name === 'memberUuid'
      }
      static async find() {
        return null
      }
    }

    const missingId = await checkUserModel(async () => Member)
    assert.equal(missingId.status, 'error')
    assert.include(missingId.message, 'Member')
    assert.include(missingId.message, 'EscalatedAuthUser')

    const unresolved = await checkUserModel(async () => {
      throw new Error('Escalated: config.userModel ("#models/nope") could not be imported')
    })
    assert.equal(unresolved.status, 'error')
    assert.include(unresolved.message, 'config.userModel')

    const fine = await checkUserModel()
    assert.equal(fine.status, 'ok')
  })
})
