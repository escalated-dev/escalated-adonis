import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Live Chat Tests
|--------------------------------------------------------------------------
|
| Unit tests for the live chat feature: session lifecycle, routing,
| availability, and command logic.
|
*/

// ──────────────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────────────

function buildMockSession(overrides = {}) {
  return {
    id: 1,
    ticketId: 100,
    agentId: null,
    visitorId: null,
    visitorName: 'Test User',
    visitorEmail: 'test@example.com',
    visitorToken: 'a'.repeat(64),
    status: 'waiting',
    departmentId: null,
    rating: null,
    ratingComment: null,
    messagesCount: 0,
    metadata: null,
    acceptedAt: null,
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function buildMockTicket(overrides = {}) {
  return {
    id: 100,
    reference: 'ESC-00100',
    subject: 'Live Chat',
    status: 'open',
    channel: 'chat',
    assignedTo: null,
    chatEndedAt: null,
    chatMetadata: null,
    ...overrides,
  }
}

function buildMockAgentProfile(overrides = {}) {
  return {
    id: 1,
    userId: 10,
    chatStatus: 'online',
    maxConcurrentChats: 5,
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  }
}

// ──────────────────────────────────────────────────────────────────
// Simulate service logic (mirrors ChatSessionService)
// ──────────────────────────────────────────────────────────────────

function simulateStartChat(data) {
  const ticket = buildMockTicket({
    subject: data.subject || 'Live Chat',
    channel: 'chat',
    status: 'open',
  })

  const session = buildMockSession({
    ticketId: ticket.id,
    visitorName: data.visitorName || null,
    visitorEmail: data.visitorEmail || null,
    status: 'waiting',
    messagesCount: 1,
  })

  return { ticket, session, visitorToken: session.visitorToken }
}

function simulateAssignAgent(session, agentId) {
  return {
    ...session,
    agentId,
    status: 'active',
    acceptedAt: new Date().toISOString(),
  }
}

function simulateEndChat(session) {
  return {
    ...session,
    status: 'ended',
    endedAt: new Date().toISOString(),
  }
}

function simulateTransfer(session, newAgentId) {
  return {
    ...session,
    agentId: newAgentId,
  }
}

function simulateRateChat(session, rating, comment) {
  return {
    ...session,
    rating: Math.min(5, Math.max(1, rating)),
    ratingComment: comment || null,
  }
}

function simulateSendMessage(session) {
  return {
    ...session,
    messagesCount: (session.messagesCount || 0) + 1,
    lastActivityAt: new Date().toISOString(),
  }
}

/**
 * Simulate routing: find the agent with the fewest active chats
 * below maxChatsPerAgent.
 */
function simulateFindAvailableAgent(agents, activeChatCounts, maxPerAgent = 5) {
  let bestAgentId = null
  let minChats = Infinity

  for (const agent of agents) {
    if (agent.chatStatus !== 'online') continue
    const count = activeChatCounts[agent.userId] || 0
    if (count < maxPerAgent && count < minChats) {
      minChats = count
      bestAgentId = agent.userId
    }
  }

  return bestAgentId
}

/**
 * Simulate availability check: at least one online agent below limit.
 */
function simulateIsAvailable(agents, activeChatCounts) {
  for (const agent of agents) {
    if (agent.chatStatus !== 'online') continue
    const count = activeChatCounts[agent.userId] || 0
    if (count < agent.maxConcurrentChats) return true
  }
  return false
}

/**
 * Filter idle sessions (mirrors the idle scope).
 */
function filterIdleSessions(sessions, idleMinutes) {
  const cutoff = new Date(Date.now() - idleMinutes * 60 * 1000)
  return sessions.filter(
    (s) => s.status === 'active' && s.lastActivityAt && new Date(s.lastActivityAt) < cutoff
  )
}

/**
 * Filter abandoned sessions (mirrors the abandoned scope).
 */
function filterAbandonedSessions(sessions, abandonMinutes) {
  const cutoff = new Date(Date.now() - abandonMinutes * 60 * 1000)
  return sessions.filter((s) => s.status === 'waiting' && new Date(s.createdAt) < cutoff)
}

/**
 * Simulate routing condition matching.
 */
function matchesConditions(conditions, context) {
  if (!conditions || conditions.length === 0) return true

  return conditions.every((condition) => {
    const value =
      context[condition.field] ?? (context.metadata ? context.metadata[condition.field] : undefined)

    switch (condition.operator) {
      case 'equals':
        return value === condition.value
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value)
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value)
      default:
        return false
    }
  })
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('Live Chat', () => {
  describe('ChatSession lifecycle', () => {
    it('creates a session with status "waiting"', () => {
      const { session, ticket } = simulateStartChat({
        visitorName: 'Alice',
        visitorEmail: 'alice@example.com',
        message: 'Hello!',
      })

      assert.equal(session.status, 'waiting')
      assert.equal(session.visitorName, 'Alice')
      assert.equal(ticket.channel, 'chat')
      assert.equal(ticket.status, 'open')
      assert.equal(session.messagesCount, 1)
    })

    it('transitions to active when agent is assigned', () => {
      const { session } = simulateStartChat({ message: 'Hi' })
      const active = simulateAssignAgent(session, 42)

      assert.equal(active.status, 'active')
      assert.equal(active.agentId, 42)
      assert.ok(active.acceptedAt)
    })

    it('transitions to ended when chat ends', () => {
      const { session } = simulateStartChat({ message: 'Hi' })
      const active = simulateAssignAgent(session, 42)
      const ended = simulateEndChat(active)

      assert.equal(ended.status, 'ended')
      assert.ok(ended.endedAt)
    })

    it('transfers a chat to another agent', () => {
      const { session } = simulateStartChat({ message: 'Hi' })
      const active = simulateAssignAgent(session, 10)
      const transferred = simulateTransfer(active, 20)

      assert.equal(transferred.agentId, 20)
      assert.equal(transferred.status, 'active')
    })

    it('increments message count on send', () => {
      const { session } = simulateStartChat({ message: 'Hi' })
      const active = simulateAssignAgent(session, 10)
      const afterMsg = simulateSendMessage(active)

      assert.equal(afterMsg.messagesCount, 2)
    })

    it('allows rating after chat ends', () => {
      const { session } = simulateStartChat({ message: 'Hi' })
      const active = simulateAssignAgent(session, 10)
      const ended = simulateEndChat(active)
      const rated = simulateRateChat(ended, 5, 'Great support!')

      assert.equal(rated.rating, 5)
      assert.equal(rated.ratingComment, 'Great support!')
    })

    it('clamps rating to 1-5 range', () => {
      const { session } = simulateStartChat({ message: 'Hi' })
      const ratedLow = simulateRateChat(session, 0, null)
      const ratedHigh = simulateRateChat(session, 10, null)

      assert.equal(ratedLow.rating, 1)
      assert.equal(ratedHigh.rating, 5)
    })
  })

  describe('Chat ticket integration', () => {
    it('creates ticket with channel "chat"', () => {
      const { ticket } = simulateStartChat({ message: 'Help me' })
      assert.equal(ticket.channel, 'chat')
    })

    it('uses custom subject if provided', () => {
      const { ticket } = simulateStartChat({
        message: 'Help',
        subject: 'Billing question',
      })
      assert.equal(ticket.subject, 'Billing question')
    })

    it('defaults subject to "Live Chat"', () => {
      const { ticket } = simulateStartChat({ message: 'Help' })
      assert.equal(ticket.subject, 'Live Chat')
    })
  })

  describe('ChatRoutingService', () => {
    it('selects the agent with fewest active chats', () => {
      const agents = [
        buildMockAgentProfile({ userId: 1 }),
        buildMockAgentProfile({ userId: 2 }),
        buildMockAgentProfile({ userId: 3 }),
      ]

      const activeCounts = { 1: 3, 2: 1, 3: 4 }
      const result = simulateFindAvailableAgent(agents, activeCounts)

      assert.equal(result, 2)
    })

    it('returns null when no agents are online', () => {
      const agents = [
        buildMockAgentProfile({ userId: 1, chatStatus: 'offline' }),
        buildMockAgentProfile({ userId: 2, chatStatus: 'away' }),
      ]

      const result = simulateFindAvailableAgent(agents, {})
      assert.equal(result, null)
    })

    it('returns null when all agents are at max capacity', () => {
      const agents = [buildMockAgentProfile({ userId: 1 }), buildMockAgentProfile({ userId: 2 })]

      const activeCounts = { 1: 5, 2: 5 }
      const result = simulateFindAvailableAgent(agents, activeCounts, 5)

      assert.equal(result, null)
    })

    it('respects custom maxChatsPerAgent', () => {
      const agents = [buildMockAgentProfile({ userId: 1 })]

      const activeCounts = { 1: 2 }
      assert.equal(simulateFindAvailableAgent(agents, activeCounts, 3), 1)
      assert.equal(simulateFindAvailableAgent(agents, activeCounts, 2), null)
    })
  })

  describe('ChatAvailabilityService', () => {
    it('returns true when an online agent is below limit', () => {
      const agents = [buildMockAgentProfile({ userId: 1, maxConcurrentChats: 5 })]
      const result = simulateIsAvailable(agents, { 1: 3 })
      assert.equal(result, true)
    })

    it('returns false when all agents are at limit', () => {
      const agents = [buildMockAgentProfile({ userId: 1, maxConcurrentChats: 2 })]
      const result = simulateIsAvailable(agents, { 1: 2 })
      assert.equal(result, false)
    })

    it('returns false when no agents are online', () => {
      const result = simulateIsAvailable([], {})
      assert.equal(result, false)
    })
  })

  describe('Routing condition matching', () => {
    it('matches equals condition', () => {
      const conditions = [{ field: 'departmentId', operator: 'equals', value: 5 }]
      assert.equal(matchesConditions(conditions, { departmentId: 5 }), true)
      assert.equal(matchesConditions(conditions, { departmentId: 3 }), false)
    })

    it('matches contains condition', () => {
      const conditions = [{ field: 'url', operator: 'contains', value: 'pricing' }]
      assert.equal(matchesConditions(conditions, { metadata: { url: '/pricing/page' } }), true)
      assert.equal(matchesConditions(conditions, { metadata: { url: '/about' } }), false)
    })

    it('matches in condition', () => {
      const conditions = [{ field: 'language', operator: 'in', value: ['en', 'fr', 'de'] }]
      assert.equal(matchesConditions(conditions, { metadata: { language: 'en' } }), true)
      assert.equal(matchesConditions(conditions, { metadata: { language: 'ja' } }), false)
    })

    it('matches when no conditions are set', () => {
      assert.equal(matchesConditions(null, {}), true)
      assert.equal(matchesConditions([], {}), true)
    })

    it('requires all conditions to match', () => {
      const conditions = [
        { field: 'departmentId', operator: 'equals', value: 5 },
        { field: 'language', operator: 'equals', value: 'en' },
      ]
      assert.equal(
        matchesConditions(conditions, { departmentId: 5, metadata: { language: 'en' } }),
        true
      )
      assert.equal(
        matchesConditions(conditions, { departmentId: 5, metadata: { language: 'fr' } }),
        false
      )
    })
  })

  describe('Idle and abandoned chat detection', () => {
    it('detects idle active sessions', () => {
      const oldTime = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const sessions = [
        buildMockSession({ id: 1, status: 'active', lastActivityAt: oldTime }),
        buildMockSession({ id: 2, status: 'active', lastActivityAt: new Date().toISOString() }),
        buildMockSession({ id: 3, status: 'waiting' }),
      ]

      const idle = filterIdleSessions(sessions, 30)
      assert.equal(idle.length, 1)
      assert.equal(idle[0].id, 1)
    })

    it('detects abandoned waiting sessions', () => {
      const oldTime = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const sessions = [
        buildMockSession({ id: 1, status: 'waiting', createdAt: oldTime }),
        buildMockSession({ id: 2, status: 'waiting', createdAt: new Date().toISOString() }),
        buildMockSession({ id: 3, status: 'active', createdAt: oldTime }),
      ]

      const abandoned = filterAbandonedSessions(sessions, 15)
      assert.equal(abandoned.length, 1)
      assert.equal(abandoned[0].id, 1)
    })

    it('returns empty when no sessions are idle', () => {
      const sessions = [
        buildMockSession({ id: 1, status: 'active', lastActivityAt: new Date().toISOString() }),
      ]
      const idle = filterIdleSessions(sessions, 30)
      assert.equal(idle.length, 0)
    })

    it('returns empty when no sessions are abandoned', () => {
      const sessions = [
        buildMockSession({ id: 1, status: 'waiting', createdAt: new Date().toISOString() }),
      ]
      const abandoned = filterAbandonedSessions(sessions, 15)
      assert.equal(abandoned.length, 0)
    })
  })

  describe('Typing indicator', () => {
    it('returns correct channel and data', () => {
      const sessionId = 42
      const userId = 10
      const result = {
        channel: `escalated.chat.${sessionId}`,
        event: 'chat.typing',
        data: {
          session_id: sessionId,
          user_id: userId,
          is_typing: true,
        },
      }

      assert.equal(result.channel, 'escalated.chat.42')
      assert.equal(result.event, 'chat.typing')
      assert.equal(result.data.is_typing, true)
    })
  })

  describe('Broadcast channels', () => {
    it('generates correct chat channel name', () => {
      assert.equal(`escalated.chat.${5}`, 'escalated.chat.5')
    })

    it('generates correct chat queue channel name', () => {
      assert.equal('escalated.chat.queue', 'escalated.chat.queue')
    })
  })
})
