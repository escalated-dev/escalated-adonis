import { test } from '@japa/runner'
import { createHash, createHmac } from 'node:crypto'
import { InertiaClient, testApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'
import { getConfig } from '../../src/helpers/config.js'
import { pusherTransport } from '../../src/support/realtime.js'

/*
 * Realtime notifications (ADR 2026-11-05-agent-panel-data, section 4): with
 * broadcasting on, each new in-app notification goes out as
 * `notification.created` on the agent's private channel
 * `escalated.agents.{id}`, which the frontend's Echo client listens on, and
 * `escalated.broadcasting.auth` signs that channel for its agent only.
 */

const AGENT = TEST_USERS.agent
const ADMIN = TEST_USERS.admin
const CUSTOMER = TEST_USERS.customer
const PUSHER = { appId: '42', key: 'app-key', secret: 'app-secret', host: 'soketi.test' }

let seq = 0

async function models() {
  const { default: Ticket } = await import('../../src/models/ticket.js')
  const { default: AgentNotification } = await import('../../src/models/agent_notification.js')
  return { Ticket, AgentNotification }
}

async function customerTicket() {
  const { Ticket } = await models()
  seq += 1
  return Ticket.create({
    requesterType: 'User',
    requesterId: CUSTOMER.id,
    reference: `PUSH-${Date.now()}-${seq}`,
    subject: 'Printer on fire',
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
  const { Ticket, AgentNotification } = await models()
  await AgentNotification.query().delete()
  await Ticket.query().delete()
}

async function eventually<T>(read: () => T | Promise<T>, done: (value: T) => boolean): Promise<T> {
  let value = await read()
  for (let i = 0; i < 50 && !done(value); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20))
    value = await read()
  }
  return value
}

test.group('Notification broadcast', (group) => {
  let agent: InertiaClient
  let admin: InertiaClient
  let sent: Array<{ channel: string; event: string; data: any }>

  group.setup(async () => {
    const running = await testApp()
    agent = new InertiaClient(running.baseUrl, { user: AGENT })
    admin = new InertiaClient(running.baseUrl, { user: ADMIN })
    await clean()
  })
  group.each.setup(() => {
    sent = []
    return () => {
      delete (getConfig() as any).broadcasting
    }
  })
  group.each.teardown(async () => {
    await clean()
  })

  async function assign(ticket: any) {
    const { default: AssignmentService } = await import('../../src/services/assignment_service.js')
    await new AssignmentService().assign(ticket, AGENT.id, ADMIN as any)
  }

  test('a new notification is broadcast on the agent channel', async ({ assert }) => {
    ;(getConfig() as any).broadcasting = {
      enabled: true,
      transport: (channel: string, event: string, data: any) => {
        sent.push({ channel, event, data })
      },
    }
    const ticket = await customerTicket()
    await assign(ticket)

    await eventually(
      () => sent,
      (value) => value.length > 0
    )
    const { AgentNotification } = await models()
    const row = await AgentNotification.query().where('user_id', AGENT.id).firstOrFail()
    assert.lengthOf(sent, 1)
    assert.equal(sent[0].channel, `escalated.agents.${AGENT.id}`)
    assert.equal(sent[0].event, 'notification.created')
    assert.deepInclude(sent[0].data, {
      id: String(row.id),
      type: 'ticket_assigned',
      title: `${ticket.reference} was assigned to you`,
      body: 'Printer on fire',
      read_at: null,
    })
    assert.deepEqual(sent[0].data.ticket, {
      id: ticket.id,
      reference: ticket.reference,
      subject: 'Printer on fire',
    })
  })

  test('nothing is broadcast while broadcasting is off', async ({ assert }) => {
    await assign(await customerTicket())
    const { AgentNotification } = await models()
    const rows = await eventually(
      async () => AgentNotification.query().where('user_id', AGENT.id),
      (value) => value.length > 0
    )
    assert.lengthOf(rows, 1)
    assert.lengthOf(sent, 0)
  })

  test('a failing transport never fails the action', async ({ assert }) => {
    ;(getConfig() as any).broadcasting = {
      enabled: true,
      transport: () => {
        throw new Error('socket server down')
      },
    }
    await assign(await customerTicket())
    const { AgentNotification } = await models()
    const rows = await eventually(
      async () => AgentNotification.query().where('user_id', AGENT.id),
      (value) => value.length > 0
    )
    assert.lengthOf(rows, 1)
  })

  test('the Pusher-protocol channel auth signs only your own channel', async ({ assert }) => {
    const post = (client: InertiaClient, data: Record<string, string>) =>
      client.visit('POST', '/support/agent/broadcasting/auth', {
        data,
        headers: { Accept: 'application/json' },
        inertia: false,
      })

    const off = await post(agent, { socket_id: '1.2', channel_name: 'private-escalated.agents.2' })
    assert.equal(off.status, 404)

    ;(getConfig() as any).broadcasting = { enabled: true, pusher: PUSHER }
    const channel = `private-escalated.agents.${AGENT.id}`
    const mine = await post(agent, { socket_id: '1234.5678', channel_name: channel })
    assert.equal(mine.status, 200, JSON.stringify(mine.body))
    const signature = createHmac('sha256', PUSHER.secret)
      .update(`1234.5678:${channel}`)
      .digest('hex')
    assert.deepEqual(mine.body, { auth: `app-key:${signature}` })

    const theirs = await post(admin, { socket_id: '1234.5678', channel_name: channel })
    assert.equal(theirs.status, 403)
  })

  test('the Pusher transport signs its HTTP API request', async ({ assert }) => {
    const calls: Array<{ url: string; init: any }> = []
    const fetcher = (async (url: string, init: any) => {
      calls.push({ url, init })
      return new Response('{}', { status: 200 })
    }) as any
    await pusherTransport(PUSHER, fetcher)('escalated.agents.2', 'notification.created', {
      id: 'x',
    })

    assert.lengthOf(calls, 1)
    const url = new URL(calls[0].url)
    assert.equal(url.origin, 'https://soketi.test')
    assert.equal(url.pathname, '/apps/42/events')
    const body = calls[0].init.body
    assert.deepEqual(JSON.parse(body), {
      name: 'notification.created',
      channels: ['private-escalated.agents.2'],
      data: JSON.stringify({ id: 'x' }),
    })
    assert.equal(url.searchParams.get('body_md5'), createHash('md5').update(body).digest('hex'))
    const params = ['auth_key', 'auth_timestamp', 'auth_version', 'body_md5']
      .map((name) => `${name}=${url.searchParams.get(name)}`)
      .join('&')
    const expected = createHmac('sha256', PUSHER.secret)
      .update(`POST\n/apps/42/events\n${params}`)
      .digest('hex')
    assert.equal(url.searchParams.get('auth_signature'), expected)
  })
})
