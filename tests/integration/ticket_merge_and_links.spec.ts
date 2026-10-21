import { test } from '@japa/runner'
import { InertiaClient, sqlTimestamp, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| Ticket merge, ticket links, side conversations and mentions
|--------------------------------------------------------------------------
|
| The shared frontend's TicketMergeDialog, TicketLinkPanel and
| SideConversation components call these admin routes by name, with the
| bodies escalated-laravel accepts (TicketMergeController,
| TicketLinkController, SideConversationController). Mentions are the agent's
| unread @-mentions.
|
*/

const ADMIN = '/support/admin'

test.group('Ticket merge, links, side conversations and mentions', (group) => {
  let running: TestApp
  let admin: InertiaClient

  group.setup(async () => {
    running = await testApp()
  })

  group.each.setup(() => {
    admin = new InertiaClient(running.baseUrl, { user: TEST_USERS.admin })
  })

  group.each.timeout(30_000)

  let sequence = 0
  async function openTicket(subject = 'Merge test') {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `MRG-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject,
      description: 'Opened by the merge tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  async function reply(ticketId: number, body: string) {
    const { default: Reply } = await import('../../src/models/reply.js')
    return Reply.create({
      ticketId,
      authorType: 'User',
      authorId: TEST_USERS.customer.id,
      body,
      isInternalNote: false,
      isPinned: false,
      type: 'reply',
    } as any)
  }

  async function reload(id: number) {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.findOrFail(id)
  }

  async function statusOf(id: number) {
    const ticket = await reload(id)
    return ticket.status
  }

  async function bodyOf(path: string, key: string) {
    const visit = await getJson(path)
    return visit.body[key]
  }

  async function getJson(path: string, user = TEST_USERS.admin) {
    const visit = await new InertiaClient(running.baseUrl, { user }).visit('GET', path, {
      headers: { 'Accept': 'application/json', 'X-Inertia': '' },
    })
    return visit
  }

  // ---- Merge -----------------------------------------------------------------

  test('merge-search finds open tickets by reference or subject', async ({ assert }) => {
    const ticket = await openTicket('Printer on fire')
    const byReference = await getJson(`${ADMIN}/tickets/merge-search?q=${ticket.reference}`)
    assert.equal(byReference.status, 200, JSON.stringify(byReference.body))
    assert.deepInclude(
      byReference.body.tickets.map((t: any) => t.reference),
      ticket.reference
    )
    const found = byReference.body.tickets.find((t: any) => t.reference === ticket.reference)
    assert.containsSubset(found, { id: ticket.id, subject: 'Printer on fire', status: 'open' })

    const bySubject = await getJson(`${ADMIN}/tickets/merge-search?q=on%20fire`)
    assert.include(
      bySubject.body.tickets.map((t: any) => t.reference),
      ticket.reference
    )
  })

  test('merge moves the replies, notes both tickets, closes and points the source', async ({
    assert,
  }) => {
    const { default: emitter } = await import('@adonisjs/core/services/emitter')
    const { ESCALATED_EVENTS } = await import('../../src/events/index.js')
    const seen: string[] = []
    const offStatus = emitter.on(ESCALATED_EVENTS.TICKET_STATUS_CHANGED, (data: any) => {
      seen.push(`status:${data.ticket.reference}:${data.oldStatus}->${data.newStatus}`)
    })
    const offClosed = emitter.on(ESCALATED_EVENTS.TICKET_CLOSED, (data: any) => {
      seen.push(`closed:${data.ticket.reference}`)
    })

    const source = await openTicket('Duplicate')
    const target = await openTicket('Original')
    const moved = await reply(source.id, 'Please help')

    const visit = await admin.visit('POST', `${ADMIN}/tickets/${source.reference}/merge`, {
      data: { target_reference: target.reference },
      referer: `${ADMIN}/tickets/${source.reference}`,
    })
    offStatus()
    offClosed()
    assert.equal(visit.status, 302, JSON.stringify(visit.body))
    assert.equal(visit.location, `${ADMIN}/tickets/${source.reference}`)

    const followed = await admin.visit('GET', visit.location!)
    assert.include(JSON.stringify(followed.body.flash), target.reference)

    const movedRow = await running.db.from('escalated_replies').where('id', moved.id).first()
    assert.equal(movedRow.ticket_id, target.id)

    const targetNotes = await running.db
      .from('escalated_replies')
      .where('ticket_id', target.id)
      .where('is_internal_note', true)
    assert.lengthOf(targetNotes, 1)
    assert.include(targetNotes[0].body, source.reference)
    const sourceNotes = await running.db
      .from('escalated_replies')
      .where('ticket_id', source.id)
      .where('is_internal_note', true)
    assert.lengthOf(sourceNotes, 1)
    assert.include(sourceNotes[0].body, target.reference)

    const closed = await reload(source.id)
    assert.equal(closed.status, 'closed')
    assert.equal(closed.mergedIntoId, target.id)
    assert.equal(await statusOf(target.id), 'open')

    assert.include(seen, `status:${source.reference}:open->closed`)
    assert.include(seen, `closed:${source.reference}`)

    // A merged ticket is no longer offered as a target.
    const search = await getJson(`${ADMIN}/tickets/merge-search?q=${source.reference}`)
    assert.notInclude(
      search.body.tickets.map((t: any) => t.reference),
      source.reference
    )
  })

  test('merge refuses the ticket itself and a merged target', async ({ assert }) => {
    const ticket = await openTicket()
    const self = await admin.visit('POST', `${ADMIN}/tickets/${ticket.reference}/merge`, {
      data: { target_reference: ticket.reference },
      referer: `${ADMIN}/tickets/${ticket.reference}`,
    })
    assert.equal(self.status, 302)
    const page = await admin.visit('GET', self.location!)
    assert.include(JSON.stringify(page.body.flash), 'itself')
    assert.equal(await statusOf(ticket.id), 'open')

    const merged = await openTicket()
    const target = await openTicket()
    await admin.visit('POST', `${ADMIN}/tickets/${merged.reference}/merge`, {
      data: { target_reference: target.reference },
      referer: ADMIN,
    })
    const intoMerged = await admin.visit('POST', `${ADMIN}/tickets/${ticket.reference}/merge`, {
      data: { target_reference: merged.reference },
      referer: ADMIN,
    })
    assert.equal(intoMerged.status, 404)

    const missing = await admin.visit('POST', `${ADMIN}/tickets/${ticket.reference}/merge`, {
      data: {},
      referer: ADMIN,
    })
    assert.equal(missing.status, 302)
    assert.equal(await statusOf(ticket.id), 'open')
  })

  test('agents cannot use the admin merge route', async ({ assert }) => {
    const source = await openTicket()
    const target = await openTicket()
    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    const visit = await agent.visit('POST', `${ADMIN}/tickets/${source.reference}/merge`, {
      data: { target_reference: target.reference },
      referer: ADMIN,
    })
    assert.equal(visit.status, 403)
    assert.equal(await statusOf(source.id), 'open')
  })

  // ---- Links -----------------------------------------------------------------

  test('links: create, list from both ends, refuse duplicates, delete', async ({ assert }) => {
    const a = await openTicket('Incident')
    const b = await openTicket('Problem')

    const created = await admin.visit('POST', `${ADMIN}/tickets/${a.reference}/links`, {
      data: { target_reference: b.reference, link_type: 'problem_incident' },
      referer: `${ADMIN}/tickets/${a.reference}`,
    })
    assert.equal(created.status, 302)

    const fromA = await getJson(`${ADMIN}/tickets/${a.reference}/links`)
    assert.equal(fromA.status, 200, JSON.stringify(fromA.body))
    assert.lengthOf(fromA.body.links, 1)
    const link = fromA.body.links[0]
    assert.equal(link.link_type, 'problem_incident')
    assert.equal(link.direction, 'parent')
    assert.equal(link.ticket.reference, b.reference)

    const fromB = await getJson(`${ADMIN}/tickets/${b.reference}/links`)
    assert.equal(fromB.body.links[0].direction, 'child')
    assert.equal(fromB.body.links[0].ticket.reference, a.reference)

    const duplicate = await admin.visit('POST', `${ADMIN}/tickets/${b.reference}/links`, {
      data: { target_reference: a.reference, link_type: 'problem_incident' },
      referer: `${ADMIN}/tickets/${b.reference}`,
    })
    const page = await admin.visit('GET', duplicate.location!)
    assert.include(JSON.stringify(page.body.flash), 'already linked')

    const badType = await admin.visit('POST', `${ADMIN}/tickets/${a.reference}/links`, {
      data: { target_reference: b.reference, link_type: 'cousin' },
      referer: `${ADMIN}/tickets/${a.reference}`,
    })
    assert.equal(badType.status, 302)
    assert.lengthOf(await bodyOf(`${ADMIN}/tickets/${a.reference}/links`, 'links'), 1)

    const removed = await admin.visit(
      'DELETE',
      `${ADMIN}/tickets/${a.reference}/links/${link.id}`,
      {
        referer: `${ADMIN}/tickets/${a.reference}`,
      }
    )
    assert.equal(removed.status, 302)
    assert.lengthOf(await bodyOf(`${ADMIN}/tickets/${a.reference}/links`, 'links'), 0)
  })

  test('a link id from another ticket is not deleted', async ({ assert }) => {
    const a = await openTicket()
    const b = await openTicket()
    const c = await openTicket()
    await admin.visit('POST', `${ADMIN}/tickets/${a.reference}/links`, {
      data: { target_reference: b.reference, link_type: 'related' },
      referer: ADMIN,
    })
    const [link] = await bodyOf(`${ADMIN}/tickets/${a.reference}/links`, 'links')
    const visit = await admin.visit('DELETE', `${ADMIN}/tickets/${c.reference}/links/${link.id}`, {
      referer: ADMIN,
    })
    assert.equal(visit.status, 404)
    assert.lengthOf(await bodyOf(`${ADMIN}/tickets/${a.reference}/links`, 'links'), 1)
  })

  // ---- Side conversations ------------------------------------------------------

  test('side conversations: open with a first reply, reply, list and close', async ({ assert }) => {
    const ticket = await openTicket()
    const base = `${ADMIN}/tickets/${ticket.reference}/side-conversations`

    const created = await admin.visit('POST', base, {
      data: { subject: 'Ask billing', channel: 'internal', body: 'Can we refund?' },
      referer: `${ADMIN}/tickets/${ticket.reference}`,
    })
    assert.equal(created.status, 302)

    let list = await getJson(base)
    assert.equal(list.status, 200, JSON.stringify(list.body))
    assert.lengthOf(list.body.conversations, 1)
    const conversation = list.body.conversations[0]
    assert.containsSubset(conversation, {
      subject: 'Ask billing',
      channel: 'internal',
      status: 'open',
    })
    assert.deepEqual(
      conversation.replies.map((r: any) => r.body),
      ['Can we refund?']
    )

    await admin.visit('POST', `${base}/${conversation.id}/reply`, {
      data: { body: 'Yes, go ahead.' },
      referer: ADMIN,
    })
    await admin.visit('POST', `${base}/${conversation.id}/close`, { referer: ADMIN })

    list = await getJson(base)
    assert.equal(list.body.conversations[0].status, 'closed')
    assert.deepEqual(
      list.body.conversations[0].replies.map((r: any) => r.body),
      ['Can we refund?', 'Yes, go ahead.']
    )

    const invalid = await admin.visit('POST', base, {
      data: { subject: 'x', channel: 'carrier-pigeon', body: 'y' },
      referer: ADMIN,
    })
    assert.equal(invalid.status, 302)
    assert.lengthOf(await bodyOf(base, 'conversations'), 1)

    // A conversation is reached only through its own ticket.
    const other = await openTicket()
    const foreign = await admin.visit(
      'POST',
      `${ADMIN}/tickets/${other.reference}/side-conversations/${conversation.id}/reply`,
      { data: { body: 'wrong ticket' }, referer: ADMIN }
    )
    assert.equal(foreign.status, 404)
  })

  // ---- Mentions --------------------------------------------------------------

  test('an agent lists unread mentions and marks them read', async ({ assert }) => {
    const ticket = await openTicket()
    const mentioned = await reply(ticket.id, '@agent2 can you look?')
    await running.db.table('escalated_mentions').insert({
      reply_id: mentioned.id,
      user_id: TEST_USERS.agent.id,
      created_at: sqlTimestamp(),
    })

    const unread = await getJson('/support/agent/mentions', TEST_USERS.agent)
    assert.equal(unread.status, 200, JSON.stringify(unread.body))
    const mine = unread.body.filter((m: any) => m.reply_id === mentioned.id)
    assert.lengthOf(mine, 1)
    assert.equal(mine[0].ticket_reference, ticket.reference)

    const agent = new InertiaClient(running.baseUrl, { user: TEST_USERS.agent })
    const read = await agent.visit('POST', '/support/agent/mentions/read', {
      data: { mention_ids: [mine[0].id] },
      headers: { 'Accept': 'application/json', 'X-Inertia': '' },
    })
    assert.equal(read.status, 200, JSON.stringify(read.body))
    assert.equal(read.body.marked_read, 1)

    const after = await getJson('/support/agent/mentions', TEST_USERS.agent)
    assert.lengthOf(
      after.body.filter((m: any) => m.reply_id === mentioned.id),
      0
    )

    // Customers have no mentions inbox.
    const customer = await getJson('/support/agent/mentions', TEST_USERS.customer)
    assert.equal(customer.status, 403)
  })
})
