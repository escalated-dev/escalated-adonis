import { test } from '@japa/runner'
import { testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Ticket primary key
|--------------------------------------------------------------------------
|
| `Ticket` declared `selfAssignPrimaryKey = true`, which tells Lucid the
| application sets the id before inserting, so Lucid never reads back the id
| the database generates. `escalated_tickets.id` is auto-increment, so every
| ticket created through the model came back with no id. `TicketService.create`
| then failed writing the ticket's first activity row (ticket_id NOT NULL),
| before it emitted `ticket.created`.
|
*/

const requester = { id: TEST_USERS.customer.id, constructor: { name: 'User' } }

test.group('Ticket primary key', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  test('Ticket.create reads back the id the database assigned', async ({ assert }) => {
    const { default: Ticket } = await import('../../src/models/ticket.js')

    const ticket = await Ticket.create({
      reference: `PK-MODEL-${Date.now()}`,
      requesterType: 'User',
      requesterId: requester.id,
      subject: 'Created through the model',
      description: 'Ticket primary key test',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    assert.isNumber(ticket.id)
    const row = await running.db.from('escalated_tickets').where('id', ticket.id).first()
    assert.equal(row?.reference, ticket.reference)
  })

  test('TicketService.create stores the ticket, logs its activity and fires ticket.created', async ({
    assert,
  }) => {
    const { default: TicketService } = await import('../../src/services/ticket_service.js')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    const { default: emitter } = await import('@adonisjs/core/services/emitter')

    const fired: number[] = []
    const listener = (data: { ticket: { id: number } }) => {
      fired.push(data.ticket.id)
    }
    emitter.on(ESCALATED_EVENTS.TICKET_CREATED, listener)

    try {
      const ticket = await new TicketService().create(requester, {
        subject: 'Created through the service',
        description: 'Ticket primary key test',
        priority: 'low',
      })

      assert.isNumber(ticket.id)

      const row = await running.db.from('escalated_tickets').where('id', ticket.id).first()
      assert.equal(row?.subject, 'Created through the service')

      const activities = await running.db
        .from('escalated_ticket_activities')
        .where('ticket_id', ticket.id)
      assert.lengthOf(activities, 1)
      assert.equal(activities[0].type, 'status_changed')

      assert.deepEqual(fired, [ticket.id])
    } finally {
      emitter.off(ESCALATED_EVENTS.TICKET_CREATED, listener)
    }
  })
})
