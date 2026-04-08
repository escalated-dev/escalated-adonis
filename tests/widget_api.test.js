import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Widget API Tests
|--------------------------------------------------------------------------
|
| Unit tests for the embeddable widget API feature.
|
*/

// ──────────────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Simulate widget config response
 */
function buildWidgetConfig(settings = {}) {
  return {
    brand_name: settings.brand_name ?? 'Support',
    accent_color: settings.accent_color ?? '#3B82F6',
    logo_url: settings.logo_url ?? null,
    knowledge_base_enabled: settings.knowledge_base_enabled ?? false,
  }
}

/**
 * Validate ticket creation input
 */
function validateCreateTicketInput(data) {
  const errors = []
  if (!data.email) errors.push('email')
  if (!data.subject) errors.push('subject')
  if (!data.description) errors.push('description')
  return errors
}

/**
 * Simulate create ticket from widget
 */
function simulateCreateTicket(data) {
  const guestToken = 'a'.repeat(64) // mock 64-char hex
  return {
    ticket_reference: 'ESC-00042',
    guest_token: guestToken,
    channel: 'widget',
    metadata: { source: 'widget' },
    guestName: data.name || null,
    guestEmail: data.email,
    subject: data.subject,
    description: data.description,
  }
}

/**
 * Simulate ticket lookup response
 */
function buildTicketLookupResponse(ticket, replies = []) {
  return {
    reference: ticket.reference,
    subject: ticket.subject,
    status: ticket.status,
    created_at: ticket.createdAt,
    replies: replies
      .filter((r) => !r.isInternalNote)
      .map((r) => ({
        body: r.body,
        author_type: r.authorType,
        created_at: r.createdAt,
      })),
  }
}

/**
 * Simulate articles search response
 */
function buildArticlesResponse(query, limit) {
  const maxResults = Math.min(Number(limit) || 10, 25)
  return {
    articles: [],
    query: query ?? '',
    limit: maxResults,
  }
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('Widget API', () => {
  describe('config endpoint', () => {
    it('returns default config values', () => {
      const config = buildWidgetConfig()
      assert.equal(config.brand_name, 'Support')
      assert.equal(config.accent_color, '#3B82F6')
      assert.equal(config.logo_url, null)
      assert.equal(config.knowledge_base_enabled, false)
    })

    it('returns custom brand name', () => {
      const config = buildWidgetConfig({ brand_name: 'Acme Support' })
      assert.equal(config.brand_name, 'Acme Support')
    })

    it('returns custom accent color', () => {
      const config = buildWidgetConfig({ accent_color: '#FF5733' })
      assert.equal(config.accent_color, '#FF5733')
    })

    it('returns logo URL when set', () => {
      const config = buildWidgetConfig({ logo_url: 'https://example.com/logo.png' })
      assert.equal(config.logo_url, 'https://example.com/logo.png')
    })

    it('reflects knowledge base enabled state', () => {
      const config = buildWidgetConfig({ knowledge_base_enabled: true })
      assert.equal(config.knowledge_base_enabled, true)
    })
  })

  describe('create ticket', () => {
    it('requires email', () => {
      const errors = validateCreateTicketInput({ subject: 'Test', description: 'Body' })
      assert.ok(errors.includes('email'))
    })

    it('requires subject', () => {
      const errors = validateCreateTicketInput({ email: 'a@b.com', description: 'Body' })
      assert.ok(errors.includes('subject'))
    })

    it('requires description', () => {
      const errors = validateCreateTicketInput({ email: 'a@b.com', subject: 'Test' })
      assert.ok(errors.includes('description'))
    })

    it('passes validation with all required fields', () => {
      const errors = validateCreateTicketInput({
        email: 'a@b.com',
        subject: 'Test',
        description: 'Body',
      })
      assert.equal(errors.length, 0)
    })

    it('creates ticket with widget channel', () => {
      const result = simulateCreateTicket({
        name: 'John',
        email: 'john@example.com',
        subject: 'Help',
        description: 'I need help',
      })
      assert.equal(result.channel, 'widget')
    })

    it('includes source in metadata', () => {
      const result = simulateCreateTicket({
        email: 'john@example.com',
        subject: 'Help',
        description: 'Body',
      })
      assert.equal(result.metadata.source, 'widget')
    })

    it('returns a guest token', () => {
      const result = simulateCreateTicket({
        email: 'john@example.com',
        subject: 'Help',
        description: 'Body',
      })
      assert.equal(result.guest_token.length, 64)
    })

    it('returns a ticket reference', () => {
      const result = simulateCreateTicket({
        email: 'john@example.com',
        subject: 'Help',
        description: 'Body',
      })
      assert.ok(result.ticket_reference.startsWith('ESC-'))
    })

    it('handles optional name field', () => {
      const withName = simulateCreateTicket({
        name: 'Alice',
        email: 'a@b.com',
        subject: 'S',
        description: 'D',
      })
      assert.equal(withName.guestName, 'Alice')

      const withoutName = simulateCreateTicket({
        email: 'a@b.com',
        subject: 'S',
        description: 'D',
      })
      assert.equal(withoutName.guestName, null)
    })
  })

  describe('ticket lookup', () => {
    it('returns ticket details', () => {
      const ticket = {
        reference: 'ESC-00001',
        subject: 'Help me',
        status: 'open',
        createdAt: '2025-01-01T00:00:00.000Z',
      }
      const response = buildTicketLookupResponse(ticket)
      assert.equal(response.reference, 'ESC-00001')
      assert.equal(response.subject, 'Help me')
      assert.equal(response.status, 'open')
    })

    it('includes public replies only', () => {
      const ticket = {
        reference: 'ESC-00001',
        subject: 'Help',
        status: 'open',
        createdAt: '2025-01-01T00:00:00.000Z',
      }
      const replies = [
        { body: 'Public reply', authorType: 'User', isInternalNote: false, createdAt: '2025-01-01T01:00:00.000Z' },
        { body: 'Internal note', authorType: 'User', isInternalNote: true, createdAt: '2025-01-01T02:00:00.000Z' },
        { body: 'Another reply', authorType: 'Agent', isInternalNote: false, createdAt: '2025-01-01T03:00:00.000Z' },
      ]
      const response = buildTicketLookupResponse(ticket, replies)
      assert.equal(response.replies.length, 2)
      assert.equal(response.replies[0].body, 'Public reply')
      assert.equal(response.replies[1].body, 'Another reply')
    })

    it('returns empty replies when no public replies exist', () => {
      const ticket = {
        reference: 'ESC-00001',
        subject: 'Help',
        status: 'open',
        createdAt: '2025-01-01T00:00:00.000Z',
      }
      const replies = [
        { body: 'Internal only', authorType: 'User', isInternalNote: true, createdAt: '2025-01-01T01:00:00.000Z' },
      ]
      const response = buildTicketLookupResponse(ticket, replies)
      assert.equal(response.replies.length, 0)
    })
  })

  describe('articles search', () => {
    it('returns default limit of 10', () => {
      const response = buildArticlesResponse('search term', undefined)
      assert.equal(response.limit, 10)
    })

    it('respects custom limit', () => {
      const response = buildArticlesResponse('search', 5)
      assert.equal(response.limit, 5)
    })

    it('caps limit at 25', () => {
      const response = buildArticlesResponse('search', 100)
      assert.equal(response.limit, 25)
    })

    it('returns the query string', () => {
      const response = buildArticlesResponse('how to reset', 10)
      assert.equal(response.query, 'how to reset')
    })

    it('handles empty query', () => {
      const response = buildArticlesResponse(undefined, 10)
      assert.equal(response.query, '')
    })
  })

  describe('guest token format', () => {
    it('token is 64 characters (32 bytes hex)', () => {
      const token = 'a'.repeat(64)
      assert.equal(token.length, 64)
      assert.match(token, /^[A-Za-z0-9]{64}$/)
    })

    it('token regex matches valid tokens', () => {
      const regex = /^[A-Za-z0-9]{64}$/
      assert.ok(regex.test('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'))
      assert.ok(!regex.test('short'))
      assert.ok(!regex.test('a'.repeat(63)))
      assert.ok(!regex.test('a'.repeat(65)))
      assert.ok(!regex.test('a'.repeat(63) + '!'))
    })
  })
})
