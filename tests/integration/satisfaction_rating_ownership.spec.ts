import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Satisfaction rating ownership
|--------------------------------------------------------------------------
|
| A ticket takes one satisfaction rating. The customer rating route resolved
| the ticket and stored the rating without checking that the signed-in user
| was the ticket's requester, unlike every other customer action on a ticket.
| So any signed-in user could rate someone else's ticket, and the real
| requester then found it already rated.
|
*/

test.group('Satisfaction rating ownership', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  let sequence = 0

  async function resolvedTicketFor(requesterId: number) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `CSAT-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId,
      subject: 'Satisfaction rating ownership',
      description: 'Opened by the satisfaction rating tests',
      status: 'resolved',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  async function ratingsFor(ticketId: number) {
    return running.db.from('escalated_satisfaction_ratings').where('ticket_id', ticketId)
  }

  test('a customer cannot rate a ticket someone else requested', async ({ assert }) => {
    const ticket = await resolvedTicketFor(TEST_USERS.customer.id)
    const stranger = new InertiaClient(running.baseUrl, { user: TEST_USERS.otherCustomer })

    const visit = await stranger.visit('POST', `/support/${ticket.reference}/rate`, {
      data: { rating: 1, comment: 'Not my ticket' },
      referer: `/support/${ticket.reference}`,
    })

    assert.equal(visit.status, 403, JSON.stringify(visit.body))
    assert.lengthOf(await ratingsFor(ticket.id), 0)
  })

  test("the ticket's requester can still rate it", async ({ assert }) => {
    const ticket = await resolvedTicketFor(TEST_USERS.customer.id)
    const requester = new InertiaClient(running.baseUrl, { user: TEST_USERS.customer })

    const visit = await requester.visit('POST', `/support/${ticket.reference}/rate`, {
      data: { rating: 5, comment: 'Sorted quickly' },
      referer: `/support/${ticket.reference}`,
    })

    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    const ratings = await ratingsFor(ticket.id)
    assert.lengthOf(ratings, 1)
    assert.equal(ratings[0].rating, 5)
    assert.equal(String(ratings[0].rated_by_id), String(TEST_USERS.customer.id))
  })
})
