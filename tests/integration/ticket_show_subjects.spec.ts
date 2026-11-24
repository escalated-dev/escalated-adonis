import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'

/*
 * The agent and admin ticket pages send `ticket.subjects` (the sidebar's
 * Related card reads it there) serialized exactly as the API ticket resource
 * serializes them, not the raw link rows Lucid preloads.
 */

let seq = 0

async function makeTicket() {
  const { default: Ticket } = await import('../../src/models/ticket.js')
  seq += 1
  return Ticket.create({
    requesterType: 'User',
    requesterId: TEST_USERS.customer.id,
    reference: `SUBJ-${Date.now()}-${seq}`,
    subject: `Subjects ${seq}`,
    description: 'Details',
    status: 'open' as const,
    priority: 'low' as const,
    ticketType: 'question',
    channel: 'web',
    slaFirstResponseBreached: false,
    slaResolutionBreached: false,
  } as any)
}

const ORDER = {
  ticketSubjectTitle: () => 'Order #1001',
  ticketSubjectSubtitle: () => 'Paid',
  ticketSubjectUrl: () => 'https://shop.example.test/orders/1001',
  ticketSubjectColor: () => '#10b981',
  ticketSubjectIcon: () => 'cart',
}

test.group('Ticket subjects on the agent and admin ticket pages', (group) => {
  let running: TestApp
  let previous: any

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(60_000)

  group.each.setup(() => {
    const config = getConfig() as any
    previous = config.ticketSubjects
    config.ticketSubjects = {
      resolver: async (type: string, id: string) =>
        type === 'Order' && id === '1001' ? ORDER : null,
    }
    return () => {
      config.ticketSubjects = previous
    }
  })

  for (const [page, user, path, component] of [
    ['agent', TEST_USERS.agent, '/support/agent/tickets', 'Escalated/Agent/TicketShow'],
    ['admin', TEST_USERS.admin, '/support/admin/tickets', 'Escalated/Admin/Tickets/Show'],
  ] as const) {
    test(`the ${page} ticket page sends ticket.subjects as the API resource does`, async ({
      assert,
    }) => {
      const ticket = await makeTicket()
      await ticket.attachSubject('Order', '1001', 'order')
      await ticket.attachSubject('Shipment', '77')

      const { default: TicketSubjectService } = await import(
        '../../src/services/ticket_subject_service.js'
      )
      const apiShape = await new TicketSubjectService().serializeForTicket(ticket)

      const response = await new InertiaClient(running.baseUrl, { user }).visit(
        'GET',
        `${path}/${ticket.reference}`
      )

      assert.equal(response.status, 200, JSON.stringify(response.body))
      assert.equal(response.body.component, component)
      assert.deepEqual(response.body.props.ticket.subjects, apiShape)
      assert.deepEqual(response.body.props.ticket.subjects[0], {
        type: 'Order',
        id: '1001',
        role: 'order',
        title: 'Order #1001',
        subtitle: 'Paid',
        url: 'https://shop.example.test/orders/1001',
        color: '#10b981',
        icon: 'cart',
        missing: false,
      })
      assert.equal(response.body.props.ticket.subjects[1].title, 'Shipment#77')
      // The page-level prop stays for pages that read it there.
      assert.deepEqual(response.body.props.subjects, apiShape)
    })

    test(`the ${page} ticket page sends an empty ticket.subjects when none are linked`, async ({
      assert,
    }) => {
      const ticket = await makeTicket()
      const response = await new InertiaClient(running.baseUrl, { user }).visit(
        'GET',
        `${path}/${ticket.reference}`
      )
      assert.equal(response.status, 200, JSON.stringify(response.body))
      assert.deepEqual(response.body.props.ticket.subjects, [])
    })
  }
})
