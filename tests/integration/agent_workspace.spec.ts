import { test } from '@japa/runner'
import { createRequire } from 'node:module'
import { DateTime } from 'luxon'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'

/*
 * What the agent ticket page needs beyond the ticket itself: the agents it can
 * be reassigned to, the requester's other tickets, and snoozing from the agent
 * panel, as escalated-laravel sends them (its AgentWorkspaceTest).
 */

const AGENT = TEST_USERS.agent
const ADMIN = TEST_USERS.admin
const CUSTOMER = TEST_USERS.customer
const TICKETS = '/support/agent/tickets'
// The shared frontend's current manifest (escalated-dev/escalated pages.json),
// which declares props the published package does not list yet.
const MANIFEST = createRequire(import.meta.url)('./fixtures/escalated-pages.json')

let seq = 0

async function models() {
  const { default: Ticket } = await import('../../src/models/ticket.js')
  const { default: Department } = await import('../../src/models/department.js')
  return { Ticket, Department }
}

async function makeTicket(attributes: Record<string, any> = {}) {
  const { Ticket } = await models()
  seq += 1
  return Ticket.create({
    requesterType: 'User',
    requesterId: CUSTOMER.id,
    reference: `WS-${Date.now()}-${seq}`,
    subject: `Workspace ${seq}`,
    description: 'Details',
    status: 'open' as const,
    priority: 'low' as const,
    ticketType: 'question',
    channel: 'web',
    slaFirstResponseBreached: false,
    slaResolutionBreached: false,
    ...attributes,
  } as any)
}

async function makeGuestTicket(attributes: Record<string, any> = {}) {
  return makeTicket({ requesterType: null, requesterId: null, ...attributes })
}

async function makeDepartment() {
  const { Department } = await models()
  seq += 1
  return Department.create({ name: `WS dept ${seq}`, slug: `ws-dept-${seq}`, isActive: true })
}

async function backdate(ticket: any, time: DateTime) {
  const { Ticket } = await models()
  const query: any = Ticket.query()
  const format = query.client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
  await Ticket.query()
    .where('id', ticket.id)
    .update({ created_at: time.toFormat(format) })
}

async function fresh(ticket: any) {
  const { Ticket } = await models()
  return Ticket.findOrFail(ticket.id)
}

async function snoozedUntil(ticket: any) {
  const after = await fresh(ticket)
  return after.snoozedUntil
}

test.group('Agent workspace', (group) => {
  let running: TestApp
  let agent: InertiaClient
  let admin: InertiaClient
  let customer: InertiaClient
  let originalVisibility: any

  async function showProps(ticket: any, as: InertiaClient = agent) {
    const response = await as.visit('GET', `${TICKETS}/${ticket.reference}`)
    if (response.status !== 200) {
      throw new Error(`show: ${response.status} ${JSON.stringify(response.body)}`)
    }
    return response.body.props
  }

  function snooze(ticket: any, until: string | undefined, as: InertiaClient = agent) {
    return as.visit('POST', `${TICKETS}/${ticket.reference}/snooze`, {
      data: until === undefined ? {} : { snoozed_until: until },
      referer: `${TICKETS}/${ticket.reference}`,
    })
  }

  async function clean() {
    const { Ticket } = await models()
    await running.db.from('escalated_ticket_activities').delete()
    await Ticket.query().delete()
  }

  group.setup(async () => {
    running = await testApp()
    agent = new InertiaClient(running.baseUrl, { user: AGENT })
    admin = new InertiaClient(running.baseUrl, { user: ADMIN })
    customer = new InertiaClient(running.baseUrl, { user: CUSTOMER })
    originalVisibility = getConfig().visibility
    await clean()
  })
  group.teardown(async () => {
    getConfig().visibility = originalVisibility
    await clean()
  })
  group.each.teardown(async () => {
    getConfig().visibility = originalVisibility
    await clean()
  })
  group.each.timeout(60000)

  // --- Reassigning -------------------------------------------------------------

  test('sends the agents and admins a ticket can be assigned to, by id and name', async ({
    assert,
  }) => {
    const ticket = await makeTicket()

    const props = await showProps(ticket)

    assert.deepEqual(props.agents, [
      { id: ADMIN.id, name: ADMIN.name },
      { id: AGENT.id, name: AGENT.name },
    ])
  })

  test('leaves out agents who cannot see the ticket under department visibility', async ({
    assert,
  }) => {
    const theirs = await makeDepartment()
    const other = await makeDepartment()
    await theirs.attachAgent(AGENT.id)
    const ticket = await makeTicket({ departmentId: other.id })
    getConfig().visibility = 'department'

    const props = await showProps(ticket, admin)

    assert.deepEqual(props.agents, [{ id: ADMIN.id, name: ADMIN.name }])

    const own = await makeTicket({ departmentId: theirs.id })
    const ownProps = await showProps(own)
    assert.deepEqual(
      ownProps.agents.map((a: any) => a.id),
      [ADMIN.id, AGENT.id]
    )
  })

  // --- The requester's other tickets --------------------------------------------

  test("sends the requester's other tickets, newest first, at most five", async ({ assert }) => {
    const older = []
    for (let i = 1; i <= 6; i++) {
      const earlier = await makeTicket({ subject: `Earlier ${i}` })
      await backdate(earlier, DateTime.now().minus({ days: 10 - i }))
      older.push(earlier)
    }
    await makeTicket({ subject: 'Someone else', requesterId: TEST_USERS.otherCustomer.id })
    const ticket = await makeTicket()

    const props = await showProps(ticket)
    const recent = props.ticket.requester_tickets

    assert.deepEqual(
      recent.map((row: any) => row.subject),
      ['Earlier 6', 'Earlier 5', 'Earlier 4', 'Earlier 3', 'Earlier 2']
    )
    assert.deepEqual(Object.keys(recent[0]), [
      'id',
      'reference',
      'subject',
      'status',
      'created_at',
      'updated_at',
    ])
    assert.equal(recent[0].reference, older[5].reference)
    assert.equal(recent[0].status, 'open')
    assert.isTrue(DateTime.fromISO(recent[0].created_at).isValid)
    assert.isTrue(DateTime.fromISO(recent[0].updated_at).isValid)
    // related_tickets is unchanged: linked tickets, not the requester's.
    assert.deepEqual(props.related_tickets, [])
  })

  test("matches a guest requester's other tickets by email", async ({ assert }) => {
    await makeGuestTicket({
      guestEmail: 'guest@example.com',
      guestName: 'Gus',
      subject: 'Earlier guest ticket',
    })
    await makeGuestTicket({ guestEmail: 'other@example.com', subject: 'Another guest' })
    await makeTicket({ subject: 'A registered requester' })
    const ticket = await makeGuestTicket({ guestEmail: 'guest@example.com', guestName: 'Gus' })

    const props = await showProps(ticket)

    assert.deepEqual(
      props.ticket.requester_tickets.map((row: any) => row.subject),
      ['Earlier guest ticket']
    )
  })

  test('only lists requester tickets the agent may see', async ({ assert }) => {
    const theirs = await makeDepartment()
    await theirs.attachAgent(AGENT.id)
    const elsewhere = await makeDepartment()
    await makeTicket({ departmentId: theirs.id, subject: 'Visible' })
    await makeTicket({ departmentId: elsewhere.id, subject: 'Hidden' })
    const ticket = await makeTicket({ departmentId: theirs.id })
    getConfig().visibility = 'department'

    const props = await showProps(ticket)

    assert.deepEqual(
      props.ticket.requester_tickets.map((row: any) => row.subject),
      ['Visible']
    )
  })

  test('sends an empty list for a ticket with no known requester', async ({ assert }) => {
    await makeTicket({ requesterType: null, requesterId: null })
    const ticket = await makeTicket({ requesterType: null, requesterId: null })

    const props = await showProps(ticket)

    assert.deepEqual(props.ticket.requester_tickets, [])
  })

  // --- Snoozing from the agent panel -----------------------------------------------

  test('lets an agent snooze a ticket', async ({ assert }) => {
    const ticket = await makeTicket()
    const until = DateTime.now().plus({ days: 1 }).startOf('minute')

    const response = await snooze(ticket, until.toISO()!)

    assert.equal(response.status, 302, JSON.stringify(response.body))
    const after = await fresh(ticket)
    assert.equal(after.snoozedUntil?.toMillis(), until.toMillis())
    assert.equal(Number(after.snoozedBy), AGENT.id)
    const back = await agent.visit('GET', `${TICKETS}/${ticket.reference}`)
    assert.isString(back.body.flash.success)
  })

  for (const [label, value] of [
    ['in the past', DateTime.now().minus({ hours: 1 }).toISO()!],
    ['that is not a date', 'next tuesday-ish'],
    ['missing', undefined],
  ] as const) {
    test(`rejects a snooze time ${label}`, async ({ assert }) => {
      const ticket = await makeTicket()

      const response = await snooze(ticket, value)

      assert.equal(response.status, 302, JSON.stringify(response.body))
      const back = await agent.visit('GET', `${TICKETS}/${ticket.reference}`)
      assert.include(Object.keys(back.body.flash.errors ?? {}), 'snoozed_until')
      assert.isNull(await snoozedUntil(ticket))
    })
  }

  test('lets an agent unsnooze a ticket, restoring its status', async ({ assert }) => {
    const ticket = await makeTicket({ status: 'in_progress' })
    await snooze(ticket, DateTime.now().plus({ days: 1 }).toISO()!)
    assert.isNotNull(await snoozedUntil(ticket))

    const response = await agent.visit('POST', `${TICKETS}/${ticket.reference}/unsnooze`, {
      referer: `${TICKETS}/${ticket.reference}`,
    })

    assert.equal(response.status, 302, JSON.stringify(response.body))
    const after = await fresh(ticket)
    assert.isNull(after.snoozedUntil)
    assert.equal(after.status, 'in_progress')
    const back = await agent.visit('GET', `${TICKETS}/${ticket.reference}`)
    assert.isString(back.body.flash.success)
  })

  test('does not let a customer snooze through the agent panel', async ({ assert }) => {
    const ticket = await makeTicket()

    const response = await snooze(ticket, DateTime.now().plus({ days: 1 }).toISO()!, customer)

    assert.equal(response.status, 403, JSON.stringify(response.body))
    assert.isNull(await snoozedUntil(ticket))
  })

  test('does not let an agent snooze a ticket outside their departments', async ({ assert }) => {
    const elsewhere = await makeDepartment()
    const ticket = await makeTicket({ departmentId: elsewhere.id })
    getConfig().visibility = 'department'

    const response = await snooze(ticket, DateTime.now().plus({ days: 1 }).toISO()!)

    assert.equal(response.status, 404, JSON.stringify(response.body))
    getConfig().visibility = originalVisibility
    assert.isNull(await snoozedUntil(ticket))
  })

  test('maps the agent snooze routes to the ticket edit permission', async ({ assert }) => {
    const { mappedPermissions } = await import('../../src/support/route_permissions.js')
    assert.deepEqual(mappedPermissions('escalated.agent.tickets.snooze'), ['ticket.edit'])
    assert.deepEqual(mappedPermissions('escalated.agent.tickets.unsnooze'), ['ticket.edit'])
  })

  // --- Page-prop parity -------------------------------------------------------------

  test('sends Escalated/Agent/TicketShow every prop the frontend declares', async ({ assert }) => {
    const ticket = await makeTicket()
    const response = await agent.visit('GET', `${TICKETS}/${ticket.reference}`)

    assert.equal(response.body.component, 'Escalated/Agent/TicketShow')
    const declared: string[] = MANIFEST.props['Escalated/Agent/TicketShow'].props
    assert.include(declared, 'agents')
    assert.deepEqual(
      declared.filter((prop) => !(prop in response.body.props)),
      []
    )
  })
})
