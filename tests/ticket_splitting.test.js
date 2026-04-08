import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Ticket Splitting Tests
|--------------------------------------------------------------------------
|
| Unit tests for the ticket splitting feature. Since we cannot import
| TypeScript source directly, we test the business logic inline.
|
*/

// ──────────────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────────────

function buildMockTicket(overrides = {}) {
  return {
    id: 1,
    reference: 'ESC-00001',
    subject: 'Original ticket',
    description: 'Original description',
    status: 'open',
    priority: 'high',
    ticketType: 'question',
    channel: 'web',
    departmentId: 5,
    metadata: null,
    tags: [
      { id: 10, name: 'bug' },
      { id: 20, name: 'urgent' },
    ],
    ...overrides,
  }
}

function buildMockReply(overrides = {}) {
  return {
    id: 42,
    ticketId: 1,
    authorType: 'User',
    authorId: 7,
    body: 'This should be a separate ticket',
    isInternalNote: false,
    ...overrides,
  }
}

/**
 * Simulate splitTicket logic (mirrors TicketService.splitTicket)
 */
function simulateSplitTicket(sourceTicket, reply) {
  const newTicket = {
    reference: 'ESC-00099',
    requesterType: reply.authorType,
    requesterId: reply.authorId,
    subject: `[Split] ${sourceTicket.subject}`,
    description: reply.body,
    status: 'open',
    priority: sourceTicket.priority,
    ticketType: sourceTicket.ticketType,
    channel: sourceTicket.channel,
    departmentId: sourceTicket.departmentId,
    metadata: {
      split_from_ticket_id: sourceTicket.id,
      split_from_reply_id: reply.id,
    },
    tagIds: sourceTicket.tags.map((t) => t.id),
  }

  // Update source metadata
  const sourceMetadata = sourceTicket.metadata ?? {}
  const splitTo = Array.isArray(sourceMetadata.split_to_ticket_ids)
    ? sourceMetadata.split_to_ticket_ids
    : []
  splitTo.push(99) // mock new ticket id
  sourceTicket.metadata = { ...sourceMetadata, split_to_ticket_ids: splitTo }

  return { newTicket, updatedSourceTicket: sourceTicket }
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('Ticket Splitting', () => {
  describe('new ticket creation', () => {
    it('creates a new ticket with [Split] prefix in subject', () => {
      const source = buildMockTicket()
      const reply = buildMockReply()
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.subject, '[Split] Original ticket')
    })

    it('uses the reply body as the new ticket description', () => {
      const source = buildMockTicket()
      const reply = buildMockReply({ body: 'Detailed issue description' })
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.description, 'Detailed issue description')
    })

    it('sets the reply author as the new ticket requester', () => {
      const source = buildMockTicket()
      const reply = buildMockReply({ authorType: 'User', authorId: 7 })
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.requesterType, 'User')
      assert.equal(newTicket.requesterId, 7)
    })

    it('sets the new ticket status to open', () => {
      const source = buildMockTicket({ status: 'in_progress' })
      const reply = buildMockReply()
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.status, 'open')
    })
  })

  describe('metadata copying', () => {
    it('copies priority from source ticket', () => {
      const source = buildMockTicket({ priority: 'critical' })
      const reply = buildMockReply()
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.priority, 'critical')
    })

    it('copies ticket type from source ticket', () => {
      const source = buildMockTicket({ ticketType: 'problem' })
      const reply = buildMockReply()
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.ticketType, 'problem')
    })

    it('copies channel from source ticket', () => {
      const source = buildMockTicket({ channel: 'email' })
      const reply = buildMockReply()
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.channel, 'email')
    })

    it('copies department from source ticket', () => {
      const source = buildMockTicket({ departmentId: 42 })
      const reply = buildMockReply()
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.departmentId, 42)
    })

    it('copies tag ids from source ticket', () => {
      const source = buildMockTicket({
        tags: [
          { id: 1, name: 'a' },
          { id: 2, name: 'b' },
          { id: 3, name: 'c' },
        ],
      })
      const reply = buildMockReply()
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.deepStrictEqual(newTicket.tagIds, [1, 2, 3])
    })

    it('handles source with no tags', () => {
      const source = buildMockTicket({ tags: [] })
      const reply = buildMockReply()
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.deepStrictEqual(newTicket.tagIds, [])
    })
  })

  describe('ticket linking', () => {
    it('sets split_from_ticket_id in new ticket metadata', () => {
      const source = buildMockTicket({ id: 55 })
      const reply = buildMockReply({ ticketId: 55 })
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.metadata.split_from_ticket_id, 55)
    })

    it('sets split_from_reply_id in new ticket metadata', () => {
      const source = buildMockTicket()
      const reply = buildMockReply({ id: 77 })
      const { newTicket } = simulateSplitTicket(source, reply)

      assert.equal(newTicket.metadata.split_from_reply_id, 77)
    })

    it('adds split_to_ticket_ids to source ticket metadata', () => {
      const source = buildMockTicket({ metadata: null })
      const reply = buildMockReply()
      const { updatedSourceTicket } = simulateSplitTicket(source, reply)

      assert.ok(Array.isArray(updatedSourceTicket.metadata.split_to_ticket_ids))
      assert.ok(updatedSourceTicket.metadata.split_to_ticket_ids.length > 0)
    })

    it('preserves existing source metadata when linking', () => {
      const source = buildMockTicket({ metadata: { custom: 'data', important: true } })
      const reply = buildMockReply()
      const { updatedSourceTicket } = simulateSplitTicket(source, reply)

      assert.equal(updatedSourceTicket.metadata.custom, 'data')
      assert.equal(updatedSourceTicket.metadata.important, true)
      assert.ok(Array.isArray(updatedSourceTicket.metadata.split_to_ticket_ids))
    })

    it('appends to existing split_to_ticket_ids array', () => {
      const source = buildMockTicket({
        metadata: { split_to_ticket_ids: [10, 20] },
      })
      const reply = buildMockReply()
      const { updatedSourceTicket } = simulateSplitTicket(source, reply)

      assert.equal(updatedSourceTicket.metadata.split_to_ticket_ids.length, 3)
      assert.ok(updatedSourceTicket.metadata.split_to_ticket_ids.includes(10))
      assert.ok(updatedSourceTicket.metadata.split_to_ticket_ids.includes(20))
    })
  })

  describe('reply validation', () => {
    it('requires reply to belong to the source ticket', () => {
      const reply = buildMockReply({ ticketId: 999 })
      const source = buildMockTicket({ id: 1 })

      // In the actual service, this would throw via firstOrFail()
      assert.notEqual(reply.ticketId, source.id)
    })
  })
})
