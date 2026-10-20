import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Customer ticket ownership
|--------------------------------------------------------------------------
|
| A customer reaching another customer's ticket was refused with a plain
| `throw new Error('Unauthorized')`, which carries no status and so answered
| 500. It answers 403, as the rating route already does.
|
*/

test.group('Customer ticket ownership', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  let sequence = 0

  async function ticketFor(requesterId: number | string, status = 'open') {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `OWN-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId,
      subject: 'Customer ticket ownership',
      description: 'Opened by the ownership tests',
      status,
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  for (const [method, action, status] of [
    ['GET', '', 'open'],
    ['POST', '/reply', 'open'],
    ['POST', '/close', 'open'],
    ['POST', '/reopen', 'closed'],
  ] as const) {
    test(`${method} ${action || 'show'} on someone else's ticket answers 403`, async ({
      assert,
    }) => {
      const ticket = await ticketFor(TEST_USERS.customer.id, status)
      const stranger = new InertiaClient(running.baseUrl, { user: TEST_USERS.otherCustomer })

      const visit = await stranger.visit(method, `/support/${ticket.reference}${action}`, {
        data: method === 'POST' ? { body: 'Not my ticket' } : undefined,
        referer: `/support/${ticket.reference}`,
      })

      assert.equal(visit.status, 403, JSON.stringify(visit.body))
    })
  }

  test('the requester still sees their own ticket when the key is stored as a string', async ({
    assert,
  }) => {
    const ticket = await ticketFor(String(TEST_USERS.customer.id))
    const owner = new InertiaClient(running.baseUrl, { user: TEST_USERS.customer })

    const visit = await owner.visit('GET', `/support/${ticket.reference}`)

    assert.equal(visit.status, 200, JSON.stringify(visit.body))
  })
})
