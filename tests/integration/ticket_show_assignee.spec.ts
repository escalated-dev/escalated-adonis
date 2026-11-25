import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
 * The agent and admin ticket pages send `ticket.assignee` ({ id, name, email }
 * from the host user model, or null), as escalated-laravel loads the assignee
 * on both show pages, so the shared sidebar can say who has the ticket even
 * when the viewer cannot reassign it. Both pages also keep their `agents` list.
 */

let seq = 0

async function makeTicket(assignedTo: number | null) {
  const { default: Ticket } = await import('../../src/models/ticket.js')
  seq += 1
  return Ticket.create({
    requesterType: 'User',
    requesterId: TEST_USERS.customer.id,
    reference: `ASGN-${Date.now()}-${seq}`,
    subject: `Assignee ${seq}`,
    description: 'Details',
    status: 'open' as const,
    priority: 'low' as const,
    ticketType: 'question',
    channel: 'web',
    assignedTo,
    slaFirstResponseBreached: false,
    slaResolutionBreached: false,
  } as any)
}

test.group('Assignee on the agent and admin ticket pages', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(60_000)

  for (const [page, user, path] of [
    ['agent', TEST_USERS.agent, '/support/agent/tickets'],
    ['admin', TEST_USERS.admin, '/support/admin/tickets'],
  ] as const) {
    test(`the ${page} ticket page sends ticket.assignee`, async ({ assert }) => {
      const ticket = await makeTicket(TEST_USERS.agent.id)
      const response = await new InertiaClient(running.baseUrl, { user }).visit(
        'GET',
        `${path}/${ticket.reference}`
      )

      assert.equal(response.status, 200, JSON.stringify(response.body))
      assert.deepEqual(response.body.props.ticket.assignee, {
        id: TEST_USERS.agent.id,
        name: TEST_USERS.agent.name,
        email: TEST_USERS.agent.email,
      })
      assert.equal(response.body.props.ticket.assignedTo, TEST_USERS.agent.id)
      assert.isArray(response.body.props.agents)
      assert.include(
        response.body.props.agents.map((agent: { id: number }) => agent.id),
        TEST_USERS.agent.id
      )
    })

    test(`the ${page} ticket page sends a null assignee when unassigned`, async ({ assert }) => {
      const ticket = await makeTicket(null)
      const response = await new InertiaClient(running.baseUrl, { user }).visit(
        'GET',
        `${path}/${ticket.reference}`
      )
      assert.equal(response.status, 200, JSON.stringify(response.body))
      assert.isNull(response.body.props.ticket.assignee)
    })
  }
})
