import { test } from '@japa/runner'
import RunEscalationsCommand from '../../src/commands/run_escalations_command.ts'
import EscalationService from '../../src/services/escalation_service.ts'

/**
 * Build a RunEscalationsCommand instance without going through the ace kernel,
 * capturing everything the command logs and stubbing the service seam.
 */
function makeCommand(evaluateRules: () => Promise<number>) {
  const cmd = Object.create(RunEscalationsCommand.prototype) as RunEscalationsCommand & {
    logger: any
    makeService: () => Promise<any>
    exitCode?: number
  }

  const logs = { info: [] as string[], success: [] as string[], error: [] as string[] }
  // BaseCommand exposes `logger` via a getter, so shadow it with an own property.
  Object.defineProperty(cmd, 'logger', {
    configurable: true,
    value: {
      info: (m: string) => logs.info.push(m),
      success: (m: string) => logs.success.push(m),
      error: (m: string) => logs.error.push(m),
    },
  })

  let calls = 0
  cmd.makeService = async () => ({
    evaluateRules: async () => {
      calls++
      return evaluateRules()
    },
  })

  return { cmd, logs, callCount: () => calls }
}

test.group('escalated:run-escalations command', () => {
  test('invokes EscalationService.evaluateRules() exactly once and reports the count', async ({
    assert,
  }) => {
    const { cmd, logs, callCount } = makeCommand(async () => 2)

    await cmd.run()

    assert.equal(callCount(), 1, 'evaluateRules should be called exactly once')
    assert.lengthOf(logs.error, 0)
    assert.lengthOf(logs.success, 1)
    assert.match(logs.success[0], /2 ticket/)
    assert.notOk(cmd.exitCode)
  })

  test('reports an idle run when no tickets match', async ({ assert }) => {
    const { cmd, logs, callCount } = makeCommand(async () => 0)

    await cmd.run()

    assert.equal(callCount(), 1)
    assert.lengthOf(logs.success, 0)
    assert.isTrue(logs.info.some((m) => /No tickets matched/.test(m)))
    assert.notOk(cmd.exitCode)
  })

  test('sets a non-zero exit code when evaluation throws', async ({ assert }) => {
    const { cmd, logs } = makeCommand(async () => {
      throw new Error('db exploded')
    })

    await cmd.run()

    assert.equal(cmd.exitCode, 1)
    assert.isTrue(logs.error.some((m) => /db exploded/.test(m)))
  })
})

test.group('EscalationService.evaluateRules() rule firing', () => {
  test('fires a matching rule’s action against a matching ticket', async ({ assert }) => {
    const priorityChanges: Array<{ ticket: any; priority: string }> = []
    const fakeTicketService: any = {
      changePriority: async (ticket: any, priority: string) => {
        priorityChanges.push({ ticket, priority })
        return ticket
      },
    }

    const rule: any = {
      id: 1,
      name: 'Aging high-priority tickets',
      conditions: [{ field: 'priority', value: 'high' }],
      actions: [{ type: 'change_priority', value: 'urgent' }],
    }
    const ticket: any = { id: 99, priority: 'high', status: 'open' }

    class TestEscalationService extends EscalationService {
      protected async loadActiveRules() {
        return [rule]
      }
      protected async findMatchingTickets(candidate: any) {
        return candidate === rule ? [ticket] : []
      }
    }

    const service = new TestEscalationService(fakeTicketService)
    const escalated = await service.evaluateRules()

    assert.equal(escalated, 1, 'one ticket should be escalated')
    assert.lengthOf(priorityChanges, 1)
    assert.strictEqual(priorityChanges[0].ticket, ticket)
    assert.equal(priorityChanges[0].priority, 'urgent')
  })

  test('routes an assign_to action through the assignment service', async ({ assert }) => {
    const assignments: Array<{ ticket: any; agentId: number }> = []
    const fakeAssignmentService: any = {
      assign: async (ticket: any, agentId: number) => {
        assignments.push({ ticket, agentId })
        return ticket
      },
    }

    const rule: any = {
      id: 2,
      name: 'Escalate to on-call',
      conditions: [{ field: 'sla_breached' }],
      actions: [{ type: 'assign_to', value: '7' }],
    }
    const ticket: any = { id: 42, status: 'open' }

    class TestEscalationService extends EscalationService {
      protected async loadActiveRules() {
        return [rule]
      }
      protected async findMatchingTickets() {
        return [ticket]
      }
    }

    const service = new TestEscalationService(undefined, fakeAssignmentService)
    const escalated = await service.evaluateRules()

    assert.equal(escalated, 1)
    assert.lengthOf(assignments, 1)
    assert.strictEqual(assignments[0].ticket, ticket)
    assert.equal(assignments[0].agentId, 7)
  })

  test('does nothing when no tickets match any rule', async ({ assert }) => {
    let actionRan = false
    const fakeTicketService: any = {
      changePriority: async () => {
        actionRan = true
      },
    }

    const rule: any = {
      id: 3,
      name: 'Never matches',
      conditions: [{ field: 'priority', value: 'high' }],
      actions: [{ type: 'change_priority', value: 'urgent' }],
    }

    class TestEscalationService extends EscalationService {
      protected async loadActiveRules() {
        return [rule]
      }
      protected async findMatchingTickets() {
        return []
      }
    }

    const service = new TestEscalationService(fakeTicketService)
    const escalated = await service.evaluateRules()

    assert.equal(escalated, 0)
    assert.isFalse(actionRan)
  })
})
