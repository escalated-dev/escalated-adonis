import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Broadcasting Tests
|--------------------------------------------------------------------------
|
| Unit tests for real-time broadcasting support.
|
*/

// ──────────────────────────────────────────────────────────────────
// Re-implement core broadcast logic for testing
// ──────────────────────────────────────────────────────────────────

function getDefaultBroadcastConfig() {
  return {
    enabled: false,
    driver: 'transmit',
    events: {
      ticketCreated: true,
      ticketUpdated: true,
      ticketStatusChanged: true,
      ticketAssigned: true,
      ticketPriorityChanged: true,
      replyCreated: true,
      internalNoteAdded: false,
    },
  }
}

function createBroadcastService(configOverrides = {}, transport = null) {
  const config = { ...getDefaultBroadcastConfig(), ...configOverrides }
  const dispatched = []

  const actualTransport =
    transport ||
    ((channel, event, data) => {
      dispatched.push({ channel, event, data })
    })

  return {
    config,
    dispatched,
    isEnabled() {
      return config.enabled
    },
    isEventEnabled(eventName) {
      return config.enabled && (config.events[eventName] ?? false)
    },
    ticketChannel(ticketId) {
      return `escalated.ticket.${ticketId}`
    },
    agentDashboardChannel() {
      return 'escalated.agents'
    },
    departmentChannel(departmentId) {
      return `escalated.department.${departmentId}`
    },
    userChannel(userId) {
      return `escalated.user.${userId}`
    },
    async broadcast(channel, event, data) {
      if (!config.enabled) return
      await actualTransport(channel, event, data)
    },
    serializeTicket(ticket) {
      return {
        id: ticket.id,
        reference: ticket.reference,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        assigned_to: ticket.assignedTo,
        department_id: ticket.departmentId,
      }
    },
    buildPayload(channel, event, data) {
      return {
        event,
        channel,
        data,
        timestamp: new Date().toISOString(),
      }
    },
    async broadcastTicketCreated(ticket) {
      if (!this.isEventEnabled('ticketCreated')) return
      const data = this.serializeTicket(ticket)
      await this.broadcast(this.agentDashboardChannel(), 'ticket.created', data)
      if (ticket.departmentId) {
        await this.broadcast(this.departmentChannel(ticket.departmentId), 'ticket.created', data)
      }
    },
    async broadcastTicketStatusChanged(ticket, oldStatus, newStatus) {
      if (!this.isEventEnabled('ticketStatusChanged')) return
      const data = { ...this.serializeTicket(ticket), old_status: oldStatus, new_status: newStatus }
      await this.broadcast(this.ticketChannel(ticket.id), 'ticket.status_changed', data)
      await this.broadcast(this.agentDashboardChannel(), 'ticket.status_changed', data)
    },
    async broadcastTicketAssigned(ticket, agentId) {
      if (!this.isEventEnabled('ticketAssigned')) return
      const data = { ...this.serializeTicket(ticket), assigned_to: agentId }
      await this.broadcast(this.ticketChannel(ticket.id), 'ticket.assigned', data)
      await this.broadcast(this.userChannel(agentId), 'ticket.assigned', data)
    },
    async broadcastReplyCreated(reply, ticket) {
      if (reply.isInternalNote) {
        if (!this.isEventEnabled('internalNoteAdded')) return
      } else {
        if (!this.isEventEnabled('replyCreated')) return
      }
      const data = {
        ticket_id: ticket.id,
        reply_id: reply.id,
        author_type: reply.authorType,
        is_internal_note: reply.isInternalNote,
        body_preview: reply.body.slice(0, 100),
      }
      await this.broadcast(
        this.ticketChannel(ticket.id),
        reply.isInternalNote ? 'reply.note_added' : 'reply.created',
        data
      )
    },
  }
}

function buildMockTicket(overrides = {}) {
  return {
    id: 1,
    reference: 'ESC-00001',
    subject: 'Test ticket',
    status: 'open',
    priority: 'medium',
    assignedTo: null,
    departmentId: null,
    ...overrides,
  }
}

function buildMockReply(overrides = {}) {
  return {
    id: 10,
    ticketId: 1,
    authorType: 'User',
    authorId: 5,
    body: 'This is a reply body',
    isInternalNote: false,
    ...overrides,
  }
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('Broadcasting', () => {
  describe('default config', () => {
    it('broadcasting is disabled by default', () => {
      const config = getDefaultBroadcastConfig()
      assert.equal(config.enabled, false)
    })

    it('default driver is transmit', () => {
      const config = getDefaultBroadcastConfig()
      assert.equal(config.driver, 'transmit')
    })

    it('most events are enabled by default', () => {
      const config = getDefaultBroadcastConfig()
      assert.equal(config.events.ticketCreated, true)
      assert.equal(config.events.ticketUpdated, true)
      assert.equal(config.events.ticketStatusChanged, true)
      assert.equal(config.events.ticketAssigned, true)
      assert.equal(config.events.replyCreated, true)
    })

    it('internal note broadcasting is disabled by default', () => {
      const config = getDefaultBroadcastConfig()
      assert.equal(config.events.internalNoteAdded, false)
    })
  })

  describe('isEnabled / isEventEnabled', () => {
    it('isEnabled returns false when disabled', () => {
      const svc = createBroadcastService({ enabled: false })
      assert.equal(svc.isEnabled(), false)
    })

    it('isEnabled returns true when enabled', () => {
      const svc = createBroadcastService({ enabled: true })
      assert.equal(svc.isEnabled(), true)
    })

    it('isEventEnabled returns false when broadcasting is disabled', () => {
      const svc = createBroadcastService({ enabled: false })
      assert.equal(svc.isEventEnabled('ticketCreated'), false)
    })

    it('isEventEnabled returns true when broadcasting and event are enabled', () => {
      const svc = createBroadcastService({ enabled: true })
      assert.equal(svc.isEventEnabled('ticketCreated'), true)
    })

    it('isEventEnabled returns false when event is disabled in config', () => {
      const svc = createBroadcastService({
        enabled: true,
        events: { ...getDefaultBroadcastConfig().events, ticketCreated: false },
      })
      assert.equal(svc.isEventEnabled('ticketCreated'), false)
    })
  })

  describe('channel names', () => {
    it('ticket channel includes ticket ID', () => {
      const svc = createBroadcastService()
      assert.equal(svc.ticketChannel(42), 'escalated.ticket.42')
    })

    it('agent dashboard channel is fixed', () => {
      const svc = createBroadcastService()
      assert.equal(svc.agentDashboardChannel(), 'escalated.agents')
    })

    it('department channel includes department ID', () => {
      const svc = createBroadcastService()
      assert.equal(svc.departmentChannel(7), 'escalated.department.7')
    })

    it('user channel includes user ID', () => {
      const svc = createBroadcastService()
      assert.equal(svc.userChannel(15), 'escalated.user.15')
    })
  })

  describe('broadcastTicketCreated', () => {
    it('broadcasts to agent dashboard when enabled', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket()
      await svc.broadcastTicketCreated(ticket)

      assert.equal(svc.dispatched.length, 1)
      assert.equal(svc.dispatched[0].channel, 'escalated.agents')
      assert.equal(svc.dispatched[0].event, 'ticket.created')
    })

    it('also broadcasts to department channel when ticket has department', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket({ departmentId: 3 })
      await svc.broadcastTicketCreated(ticket)

      assert.equal(svc.dispatched.length, 2)
      assert.equal(svc.dispatched[1].channel, 'escalated.department.3')
    })

    it('does not broadcast when disabled', async () => {
      const svc = createBroadcastService({ enabled: false })
      await svc.broadcastTicketCreated(buildMockTicket())

      assert.equal(svc.dispatched.length, 0)
    })

    it('does not broadcast when ticketCreated event is disabled', async () => {
      const svc = createBroadcastService({
        enabled: true,
        events: { ...getDefaultBroadcastConfig().events, ticketCreated: false },
      })
      await svc.broadcastTicketCreated(buildMockTicket())

      assert.equal(svc.dispatched.length, 0)
    })
  })

  describe('broadcastTicketStatusChanged', () => {
    it('broadcasts to ticket channel and agent dashboard', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket({ id: 5 })
      await svc.broadcastTicketStatusChanged(ticket, 'open', 'in_progress')

      assert.equal(svc.dispatched.length, 2)
      assert.equal(svc.dispatched[0].channel, 'escalated.ticket.5')
      assert.equal(svc.dispatched[1].channel, 'escalated.agents')
    })

    it('includes old and new status in data', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket()
      await svc.broadcastTicketStatusChanged(ticket, 'open', 'resolved')

      assert.equal(svc.dispatched[0].data.old_status, 'open')
      assert.equal(svc.dispatched[0].data.new_status, 'resolved')
    })
  })

  describe('broadcastTicketAssigned', () => {
    it('broadcasts to ticket channel and assigned agent user channel', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket({ id: 3 })
      await svc.broadcastTicketAssigned(ticket, 42)

      assert.equal(svc.dispatched.length, 2)
      assert.equal(svc.dispatched[0].channel, 'escalated.ticket.3')
      assert.equal(svc.dispatched[1].channel, 'escalated.user.42')
    })

    it('includes agent ID in data', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket()
      await svc.broadcastTicketAssigned(ticket, 99)

      assert.equal(svc.dispatched[0].data.assigned_to, 99)
    })
  })

  describe('broadcastReplyCreated', () => {
    it('broadcasts public replies when replyCreated is enabled', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket({ id: 1 })
      const reply = buildMockReply({ isInternalNote: false })
      await svc.broadcastReplyCreated(reply, ticket)

      assert.equal(svc.dispatched.length, 1)
      assert.equal(svc.dispatched[0].event, 'reply.created')
    })

    it('does not broadcast internal notes when internalNoteAdded is disabled', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket()
      const reply = buildMockReply({ isInternalNote: true })
      await svc.broadcastReplyCreated(reply, ticket)

      assert.equal(svc.dispatched.length, 0)
    })

    it('broadcasts internal notes when internalNoteAdded is enabled', async () => {
      const svc = createBroadcastService({
        enabled: true,
        events: { ...getDefaultBroadcastConfig().events, internalNoteAdded: true },
      })
      const ticket = buildMockTicket({ id: 1 })
      const reply = buildMockReply({ isInternalNote: true })
      await svc.broadcastReplyCreated(reply, ticket)

      assert.equal(svc.dispatched.length, 1)
      assert.equal(svc.dispatched[0].event, 'reply.note_added')
    })

    it('truncates body preview to 100 characters', async () => {
      const svc = createBroadcastService({ enabled: true })
      const ticket = buildMockTicket()
      const longBody = 'x'.repeat(200)
      const reply = buildMockReply({ body: longBody })
      await svc.broadcastReplyCreated(reply, ticket)

      assert.equal(svc.dispatched[0].data.body_preview.length, 100)
    })
  })

  describe('buildPayload', () => {
    it('includes event, channel, data, and timestamp', () => {
      const svc = createBroadcastService()
      const payload = svc.buildPayload('test-channel', 'test.event', { foo: 'bar' })

      assert.equal(payload.event, 'test.event')
      assert.equal(payload.channel, 'test-channel')
      assert.deepStrictEqual(payload.data, { foo: 'bar' })
      assert.ok(payload.timestamp)
    })

    it('timestamp is a valid ISO string', () => {
      const svc = createBroadcastService()
      const payload = svc.buildPayload('ch', 'ev', {})
      const parsed = new Date(payload.timestamp)
      assert.ok(!Number.isNaN(parsed.getTime()))
    })
  })

  describe('serializeTicket', () => {
    it('includes essential ticket fields', () => {
      const svc = createBroadcastService()
      const ticket = buildMockTicket({
        id: 42,
        reference: 'ESC-00042',
        subject: 'Test',
        status: 'open',
        priority: 'high',
        assignedTo: 5,
        departmentId: 3,
      })
      const serialized = svc.serializeTicket(ticket)

      assert.equal(serialized.id, 42)
      assert.equal(serialized.reference, 'ESC-00042')
      assert.equal(serialized.subject, 'Test')
      assert.equal(serialized.status, 'open')
      assert.equal(serialized.priority, 'high')
      assert.equal(serialized.assigned_to, 5)
      assert.equal(serialized.department_id, 3)
    })

    it('does not include sensitive fields like description', () => {
      const svc = createBroadcastService()
      const ticket = { ...buildMockTicket(), description: 'Secret info' }
      const serialized = svc.serializeTicket(ticket)

      assert.equal(serialized.description, undefined)
    })
  })
})
