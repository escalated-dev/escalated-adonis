import { test } from '@japa/runner'
import { InertiaClient, testApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
 * @mentions, as escalated-laravel's MentionService and AgentSearchController:
 * agents mentioned in an agent's reply or internal note get a `mention`
 * notification and an `escalated_mentions` row, and the composer's mention
 * picker searches agents at `admin/agents/search`.
 */

const AGENT = TEST_USERS.agent // "Agent 2", user2@example.test
const ADMIN = TEST_USERS.admin // "Admin 1", user1@example.test
const CUSTOMER = TEST_USERS.customer
const JSON_HEADERS = { Accept: 'application/json' }

let seq = 0

async function models() {
  const { default: Ticket } = await import('../../src/models/ticket.js')
  const { default: Reply } = await import('../../src/models/reply.js')
  const { default: AgentNotification } = await import('../../src/models/agent_notification.js')
  const { default: db } = await import('@adonisjs/lucid/services/db')
  return { Ticket, Reply, AgentNotification, db }
}

async function customerTicket() {
  const { Ticket } = await models()
  seq += 1
  return Ticket.create({
    requesterType: 'User',
    requesterId: CUSTOMER.id,
    reference: `MENTION-${Date.now()}-${seq}`,
    subject: `Mentions ${seq}`,
    description: 'Details',
    status: 'open' as const,
    priority: 'low' as const,
    ticketType: 'question',
    channel: 'web',
    slaFirstResponseBreached: false,
    slaResolutionBreached: false,
  } as any)
}

async function clean() {
  const m = await models()
  await m.AgentNotification.query().delete()
  await m.db.from('escalated_mentions').delete()
  await m.Reply.query().delete()
  await m.Ticket.query().delete()
}

/** Event listeners run after the emitting call returns; wait for their writes. */
async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  let value = await read()
  for (let i = 0; i < 50 && !done(value); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20))
    value = await read()
  }
  return value
}

async function notifications(userId: number) {
  const { AgentNotification } = await models()
  return AgentNotification.query().where('user_id', userId)
}

async function service() {
  const { default: TicketService } = await import('../../src/services/ticket_service.js')
  return new TicketService()
}

test.group('Agent @mentions', (group) => {
  let admin: InertiaClient
  let agent: InertiaClient

  const json = (client: InertiaClient, path: string) =>
    client.visit('GET', path, { headers: JSON_HEADERS, inertia: false })

  group.setup(async () => {
    const running = await testApp()
    admin = new InertiaClient(running.baseUrl, { user: ADMIN })
    agent = new InertiaClient(running.baseUrl, { user: AGENT })
    await clean()
  })
  group.each.teardown(async () => {
    await clean()
  })

  test('an agent mentioned in an internal note is notified', async ({ assert }) => {
    const ticket = await customerTicket()
    const tickets = await service()
    const note = await tickets.addNote(ticket, AGENT as any, 'Can @{Admin 1} look?')

    const rows = await eventually(
      () => notifications(ADMIN.id),
      (value) => value.length > 0
    )
    assert.deepEqual(
      rows.map((row: any) => row.type),
      ['mention']
    )
    assert.equal(rows[0].data.mentioned_by, 'Agent 2')

    const feed = await json(admin, '/support/agent/notifications')
    assert.equal(feed.status, 200, JSON.stringify(feed.body))
    assert.equal(feed.body.data[0].title, `Agent 2 mentioned you on ${ticket.reference}`)

    const { db } = await models()
    const mentions = await db.from('escalated_mentions').where('reply_id', note.id)
    assert.deepEqual(
      mentions.map((m: any) => Number(m.user_id)),
      [ADMIN.id]
    )
  })

  test('a mention in an agent reply matches by email, ignoring case', async ({ assert }) => {
    const ticket = await customerTicket()
    const tickets = await service()
    await tickets.reply(ticket, AGENT as any, 'cc @{USER1@example.test}')

    const rows = await eventually(
      () => notifications(ADMIN.id),
      (value) => value.length > 0
    )
    assert.deepEqual(
      rows.map((row: any) => row.type),
      ['mention']
    )
  })

  test('nobody hears of their own mention, a customer or an unknown name', async ({ assert }) => {
    const ticket = await customerTicket()
    const tickets = await service()
    await tickets.addNote(ticket, AGENT as any, '@{Agent 2} @{Customer 3} @nobody')
    await tickets.reply(ticket, CUSTOMER as any, 'Hello @{Admin 1}')
    await new Promise((resolve) => setTimeout(resolve, 200))

    const { AgentNotification } = await models()
    assert.lengthOf(await AgentNotification.query().where('type', 'mention'), 0)
  })

  test('the mention picker lists agents and admins by name or email', async ({ assert }) => {
    const found = await json(admin, '/support/admin/agents/search?q=AGENT')
    assert.equal(found.status, 200, JSON.stringify(found.body))
    assert.deepEqual(found.body, [{ id: AGENT.id, name: 'Agent 2', email: 'user2@example.test' }])

    const customers = await json(admin, '/support/admin/agents/search?q=customer')
    assert.deepEqual(customers.body, [])
    const empty = await json(admin, '/support/admin/agents/search?q=')
    assert.deepEqual(empty.body, [])
  })

  test('the mention picker is an admin route, as escalated-laravel', async ({ assert }) => {
    const response = await json(agent, '/support/admin/agents/search?q=admin')
    assert.notEqual(response.status, 200)
  })
})
