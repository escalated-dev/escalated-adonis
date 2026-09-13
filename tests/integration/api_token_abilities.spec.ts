import { test } from '@japa/runner'
import { InertiaClient, testApp, type TestApp } from './helpers/app.js'
import { TEST_USERS, type TestUser } from './fixtures/user.js'

/*
|--------------------------------------------------------------------------
| API token abilities
|--------------------------------------------------------------------------
|
| The admin screen issues API tokens with the abilities `agent` and `admin`,
| but the API applied its token middleware with no ability and never checked
| who owned the token. Any token, for any user, carried full agent power over
| every ticket, and could delete them.
|
| As in the Laravel reference: agent routes need the `agent` ability and an
| owner who is an agent or admin; deleting a ticket needs the `admin` ability
| and an owner who is an admin.
|
*/

test.group('API token abilities', (group) => {
  let running: TestApp

  group.setup(async () => {
    running = await testApp()
  })

  group.each.timeout(30_000)

  async function tokenFor(owner: TestUser, abilities: string[]) {
    const { default: ApiToken } = await import('../../src/models/api_token.js')
    const { plainTextToken } = await ApiToken.createToken(
      { id: owner.id, constructor: { name: 'User' } },
      `abilities test (${owner.role})`,
      abilities
    )
    return plainTextToken
  }

  function api(method: string, path: string, token: string) {
    return new InertiaClient(running.baseUrl).visit(method, `/support/api/v1${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
  }

  let sequence = 0

  async function openTicket() {
    const { default: Ticket } = await import('../../src/models/ticket.js')
    return Ticket.create({
      reference: `API-ABILITY-${Date.now()}-${++sequence}`,
      requesterType: 'User',
      requesterId: TEST_USERS.customer.id,
      subject: 'API token abilities',
      description: 'Opened by the API token abilities tests',
      status: 'open',
      priority: 'low',
      ticketType: 'question',
      channel: 'web',
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    } as any)
  }

  async function isDeleted(ticketId: number) {
    const row = await running.db.from('escalated_tickets').where('id', ticketId).first()
    return row.deleted_at !== null && row.deleted_at !== undefined
  }

  // ---- Refused ------------------------------------------------------------------

  test('a token owned by a non-agent is refused agent routes and deletion, whatever its abilities', async ({
    assert,
  }) => {
    const token = await tokenFor(TEST_USERS.customer, ['agent', 'admin'])
    const ticket = await openTicket()

    const list = await api('GET', '/tickets', token)
    assert.equal(list.status, 403, JSON.stringify(list.body))

    const destroy = await api('DELETE', `/tickets/${ticket.reference}`, token)
    assert.equal(destroy.status, 403, JSON.stringify(destroy.body))
    assert.isFalse(await isDeleted(ticket.id))
  })

  test('an agent token without the admin ability cannot delete a ticket', async ({ assert }) => {
    const token = await tokenFor(TEST_USERS.agent, ['agent'])
    const ticket = await openTicket()

    const destroy = await api('DELETE', `/tickets/${ticket.reference}`, token)

    assert.equal(destroy.status, 403, JSON.stringify(destroy.body))
    assert.equal(destroy.body.message, 'Insufficient permissions.')
    assert.isFalse(await isDeleted(ticket.id))
  })

  test('the admin ability does not let an owner who is not an admin delete a ticket', async ({
    assert,
  }) => {
    const token = await tokenFor(TEST_USERS.agent, ['agent', 'admin'])
    const ticket = await openTicket()

    const destroy = await api('DELETE', `/tickets/${ticket.reference}`, token)

    assert.equal(destroy.status, 403, JSON.stringify(destroy.body))
    assert.isFalse(await isDeleted(ticket.id))
  })

  test('a token without the agent ability is refused agent routes', async ({ assert }) => {
    const token = await tokenFor(TEST_USERS.agent, [])

    const list = await api('GET', '/tickets', token)

    assert.equal(list.status, 403, JSON.stringify(list.body))
    assert.equal(list.body.message, 'Insufficient permissions.')
  })

  // ---- Allowed ------------------------------------------------------------------

  test('an agent token still lists tickets, including a token issued with every ability', async ({
    assert,
  }) => {
    for (const abilities of [['agent'], ['*']]) {
      const token = await tokenFor(TEST_USERS.agent, abilities)

      const list = await api('GET', '/tickets', token)

      assert.equal(list.status, 200, `${abilities}: ${JSON.stringify(list.body)}`)
      assert.isArray(list.body.data)
    }
  })

  test('an admin token with the admin ability deletes a ticket', async ({ assert }) => {
    const token = await tokenFor(TEST_USERS.admin, ['agent', 'admin'])
    const ticket = await openTicket()

    const destroy = await api('DELETE', `/tickets/${ticket.reference}`, token)

    assert.equal(destroy.status, 200, JSON.stringify(destroy.body))
    assert.isTrue(await isDeleted(ticket.id))
  })
})
