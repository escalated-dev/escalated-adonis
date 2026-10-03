import { test } from '@japa/runner'
import { testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Inbound email: who a reply may post as
|--------------------------------------------------------------------------
|
| A thread match (subject reference, In-Reply-To / References) is built from
| guessable values, so it is not proof of who sent the mail. A matched email
| becomes a reply only when From is the ticket's requester, and it is posted
| as that requester, never as a user picked by the From header. Anything else
| becomes a new ticket. With an inbound reply secret configured, only the
| signed Reply-To address identifies a ticket.
|
*/

test.group('Inbound email sender check', (group) => {
  let running: TestApp
  let sequence = 0
  let savedInbound: unknown

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(() => {
    const config = (globalThis as any).__escalated_config
    savedInbound = config.inboundEmail
    return () => {
      config.inboundEmail = savedInbound
    }
  })

  group.each.timeout(30_000)

  function useReplySecret(secret: string) {
    const config = (globalThis as any).__escalated_config
    config.inboundEmail = { ...(config.inboundEmail ?? {}), replySecret: secret }
  }

  async function guestTicket(status = 'open') {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    sequence++
    return Ticket.create({
      reference: `ESC-${String(90000 + sequence)}`,
      requesterType: null,
      requesterId: null,
      guestName: 'Alice',
      guestEmail: 'alice@example.com',
      guestToken: `token-${Date.now()}-${sequence}`,
      subject: 'Printer on fire',
      description: 'Please help',
      status,
      priority: 'medium',
      ticketType: 'question',
      channel: 'email',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  async function userTicket(requesterId: number) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    sequence++
    return Ticket.create({
      reference: `ESC-${String(90000 + sequence)}`,
      requesterType: 'User',
      requesterId,
      subject: 'Account question',
      description: 'Please help',
      status: 'open',
      priority: 'medium',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  async function processInbound(message: Record<string, unknown>) {
    const { default: InboundEmailService } =
      await import('../../src/services/inbound_email_service.js')
    sequence++
    return new InboundEmailService().process(
      {
        messageId: `<inbound-${Date.now()}-${sequence}@mail.example.com>`,
        fromEmail: 'alice@example.com',
        fromName: 'Alice',
        toEmail: 'support@example.com',
        subject: 'hello',
        bodyText: 'Inbound body',
        attachments: [],
        ...message,
      } as any,
      'test'
    )
  }

  async function repliesOn(ticketId: number) {
    return running.db.from('escalated_replies').where('ticket_id', ticketId)
  }

  async function signedAddress(ticketId: number, secret: string) {
    const { buildReplyTo } = await import('../../src/services/email/message_id_util.js')
    return buildReplyTo(ticketId, secret, 'reply.example.com')
  }

  test("the requester's reply with a subject reference is added as a guest reply", async ({
    assert,
  }) => {
    const ticket = await guestTicket()

    const inbound = await processInbound({
      fromEmail: 'Alice@Example.com',
      subject: `Re: [${ticket.reference}] Printer on fire`,
    })

    assert.equal(inbound.status, 'processed')
    assert.equal(inbound.ticketId, ticket.id)
    const replies = await repliesOn(ticket.id)
    assert.lengthOf(replies, 1)
    assert.isNull(replies[0].author_type)
    assert.isNull(replies[0].author_id)
  })

  test('a stranger quoting a subject reference opens a new ticket', async ({ assert }) => {
    const ticket = await guestTicket()

    const inbound = await processInbound({
      fromEmail: 'mallory@example.com',
      fromName: 'Mallory',
      subject: `Re: [${ticket.reference}] Printer on fire`,
    })

    assert.equal(inbound.status, 'processed')
    assert.notEqual(inbound.ticketId, ticket.id)
    assert.lengthOf(await repliesOn(ticket.id), 0)

    const created = await running.db
      .from('escalated_tickets')
      .where('id', inbound.ticketId!)
      .first()
    assert.equal(created.guest_email, 'mallory@example.com')
  })

  test('a stranger threading onto a closed ticket does not reopen it', async ({ assert }) => {
    const ticket = await guestTicket('closed')
    // A message we logged for that ticket earlier, which the stranger quotes.
    const { default: InboundEmail } = await import('../../src/models/inbound_email.js')
    sequence++
    const earlier = `<earlier-${Date.now()}-${sequence}@mail.example.com>`
    await InboundEmail.create({
      messageId: earlier,
      fromEmail: 'alice@example.com',
      toEmail: 'support@example.com',
      subject: 'Printer on fire',
      status: 'processed',
      adapter: 'test',
      ticketId: ticket.id,
    } as any)

    const inbound = await processInbound({
      fromEmail: 'mallory@example.com',
      subject: 'Re: Printer on fire',
      inReplyTo: earlier,
    })

    assert.notEqual(inbound.ticketId, ticket.id)
    assert.lengthOf(await repliesOn(ticket.id), 0)
    const reloaded = await running.db.from('escalated_tickets').where('id', ticket.id).first()
    assert.equal(reloaded.status, 'closed')
  })

  test("the requester's reply reopens a closed ticket", async ({ assert }) => {
    const ticket = await guestTicket('closed')

    const inbound = await processInbound({
      subject: `Re: [${ticket.reference}] Printer on fire`,
    })

    assert.equal(inbound.ticketId, ticket.id)
    const reloaded = await running.db.from('escalated_tickets').where('id', ticket.id).first()
    assert.equal(reloaded.status, 'reopened')
  })

  test("an agent's address in From is never used to post as that agent", async ({ assert }) => {
    const ticket = await userTicket(TEST_USERS.customer.id)

    const inbound = await processInbound({
      fromEmail: TEST_USERS.agent.email,
      subject: `Re: [${ticket.reference}] Account question`,
    })

    assert.notEqual(inbound.ticketId, ticket.id)
    assert.lengthOf(await repliesOn(ticket.id), 0)
    const agentReplies = await running.db
      .from('escalated_replies')
      .where('author_id', TEST_USERS.agent.id)
    assert.lengthOf(agentReplies, 0)
  })

  test('the requester user replying by email posts as that user', async ({ assert }) => {
    const ticket = await userTicket(TEST_USERS.customer.id)

    const inbound = await processInbound({
      fromEmail: TEST_USERS.customer.email.toUpperCase(),
      subject: `Re: [${ticket.reference}] Account question`,
    })

    assert.equal(inbound.ticketId, ticket.id)
    const replies = await repliesOn(ticket.id)
    assert.lengthOf(replies, 1)
    assert.equal(replies[0].author_type, 'User')
    assert.equal(String(replies[0].author_id), String(TEST_USERS.customer.id))
  })

  test('with a reply secret, a subject reference alone does not thread', async ({ assert }) => {
    useReplySecret('inbound-secret')
    const ticket = await guestTicket()

    const inbound = await processInbound({
      subject: `Re: [${ticket.reference}] Printer on fire`,
    })

    assert.notEqual(inbound.ticketId, ticket.id)
    assert.lengthOf(await repliesOn(ticket.id), 0)
  })

  test('with a reply secret, the signed Reply-To from the requester threads', async ({
    assert,
  }) => {
    useReplySecret('inbound-secret')
    const ticket = await guestTicket()

    const inbound = await processInbound({
      toEmail: await signedAddress(ticket.id, 'inbound-secret'),
      subject: 'Re: Printer on fire',
    })

    assert.equal(inbound.ticketId, ticket.id)
    assert.lengthOf(await repliesOn(ticket.id), 1)
  })

  test('with a reply secret, a forged signature does not thread', async ({ assert }) => {
    useReplySecret('inbound-secret')
    const ticket = await guestTicket()

    const inbound = await processInbound({
      toEmail: await signedAddress(ticket.id, 'some-other-secret'),
      subject: 'Re: Printer on fire',
    })

    assert.notEqual(inbound.ticketId, ticket.id)
    assert.lengthOf(await repliesOn(ticket.id), 0)
  })

  test('with a reply secret, a stranger holding the signed address opens a new ticket', async ({
    assert,
  }) => {
    useReplySecret('inbound-secret')
    const ticket = await guestTicket()

    const inbound = await processInbound({
      fromEmail: 'mallory@example.com',
      toEmail: await signedAddress(ticket.id, 'inbound-secret'),
      subject: 'Re: Printer on fire',
    })

    assert.notEqual(inbound.ticketId, ticket.id)
    assert.lengthOf(await repliesOn(ticket.id), 0)
  })
})
