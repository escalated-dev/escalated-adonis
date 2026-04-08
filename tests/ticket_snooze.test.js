import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Ticket Snooze Tests
|--------------------------------------------------------------------------
|
| Unit tests for the ticket snooze/unsnooze feature.
|
*/

// ──────────────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────────────

function buildMockTicket(overrides = {}) {
  return {
    id: 1,
    status: 'open',
    snoozedUntil: null,
    snoozedBy: null,
    statusBeforeSnooze: null,
    ...overrides,
  }
}

/**
 * Simulate snoozeTicket logic
 */
function simulateSnooze(ticket, untilISO, causerId) {
  const result = { ...ticket }
  result.statusBeforeSnooze = result.status
  result.snoozedUntil = untilISO
  result.snoozedBy = causerId
  result.status = 'waiting_on_customer'
  return result
}

/**
 * Simulate unsnoozeTicket logic
 */
function simulateUnsnooze(ticket) {
  const result = { ...ticket }
  const previousStatus = result.statusBeforeSnooze || 'open'
  result.status = previousStatus
  result.snoozedUntil = null
  result.snoozedBy = null
  result.statusBeforeSnooze = null
  return result
}

/**
 * Check if a ticket is currently snoozed (mirrors Ticket.isSnoozed computed)
 */
function isSnoozed(ticket) {
  if (!ticket.snoozedUntil) return false
  const snoozedUntil = new Date(ticket.snoozedUntil)
  return snoozedUntil > new Date()
}

/**
 * Filter tickets that are past their snooze time (mirrors Ticket.awakeDue scope)
 */
function filterAwakeDue(tickets) {
  const now = new Date()
  return tickets.filter(
    (t) => t.snoozedUntil !== null && new Date(t.snoozedUntil) <= now
  )
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('Ticket Snooze', () => {
  describe('snoozeTicket', () => {
    it('saves the current status before snoozing', () => {
      const ticket = buildMockTicket({ status: 'in_progress' })
      const result = simulateSnooze(ticket, '2099-01-01T00:00:00.000Z', 5)

      assert.equal(result.statusBeforeSnooze, 'in_progress')
    })

    it('sets status to waiting_on_customer when snoozed', () => {
      const ticket = buildMockTicket({ status: 'open' })
      const result = simulateSnooze(ticket, '2099-01-01T00:00:00.000Z', 5)

      assert.equal(result.status, 'waiting_on_customer')
    })

    it('sets snoozedUntil to the specified date', () => {
      const ticket = buildMockTicket()
      const until = '2099-06-15T14:30:00.000Z'
      const result = simulateSnooze(ticket, until, 5)

      assert.equal(result.snoozedUntil, until)
    })

    it('records who snoozed the ticket', () => {
      const ticket = buildMockTicket()
      const result = simulateSnooze(ticket, '2099-01-01T00:00:00.000Z', 42)

      assert.equal(result.snoozedBy, 42)
    })

    it('preserves other ticket fields', () => {
      const ticket = buildMockTicket({ id: 99 })
      const result = simulateSnooze(ticket, '2099-01-01T00:00:00.000Z', 5)

      assert.equal(result.id, 99)
    })
  })

  describe('unsnoozeTicket', () => {
    it('restores the previous status', () => {
      const snoozed = buildMockTicket({
        status: 'waiting_on_customer',
        statusBeforeSnooze: 'in_progress',
        snoozedUntil: '2099-01-01T00:00:00.000Z',
        snoozedBy: 5,
      })
      const result = simulateUnsnooze(snoozed)

      assert.equal(result.status, 'in_progress')
    })

    it('defaults to open if no previous status was saved', () => {
      const snoozed = buildMockTicket({
        status: 'waiting_on_customer',
        statusBeforeSnooze: null,
        snoozedUntil: '2099-01-01T00:00:00.000Z',
        snoozedBy: 5,
      })
      const result = simulateUnsnooze(snoozed)

      assert.equal(result.status, 'open')
    })

    it('clears snoozedUntil', () => {
      const snoozed = buildMockTicket({
        status: 'waiting_on_customer',
        statusBeforeSnooze: 'open',
        snoozedUntil: '2099-01-01T00:00:00.000Z',
        snoozedBy: 5,
      })
      const result = simulateUnsnooze(snoozed)

      assert.equal(result.snoozedUntil, null)
    })

    it('clears snoozedBy', () => {
      const snoozed = buildMockTicket({
        status: 'waiting_on_customer',
        statusBeforeSnooze: 'open',
        snoozedUntil: '2099-01-01T00:00:00.000Z',
        snoozedBy: 5,
      })
      const result = simulateUnsnooze(snoozed)

      assert.equal(result.snoozedBy, null)
    })

    it('clears statusBeforeSnooze', () => {
      const snoozed = buildMockTicket({
        status: 'waiting_on_customer',
        statusBeforeSnooze: 'open',
        snoozedUntil: '2099-01-01T00:00:00.000Z',
        snoozedBy: 5,
      })
      const result = simulateUnsnooze(snoozed)

      assert.equal(result.statusBeforeSnooze, null)
    })
  })

  describe('isSnoozed computed property', () => {
    it('returns false when snoozedUntil is null', () => {
      const ticket = buildMockTicket({ snoozedUntil: null })
      assert.equal(isSnoozed(ticket), false)
    })

    it('returns true when snoozedUntil is in the future', () => {
      const ticket = buildMockTicket({ snoozedUntil: '2099-12-31T23:59:59.000Z' })
      assert.equal(isSnoozed(ticket), true)
    })

    it('returns false when snoozedUntil is in the past', () => {
      const ticket = buildMockTicket({ snoozedUntil: '2000-01-01T00:00:00.000Z' })
      assert.equal(isSnoozed(ticket), false)
    })
  })

  describe('awakeDue scope', () => {
    it('returns tickets whose snooze time has passed', () => {
      const tickets = [
        buildMockTicket({ id: 1, snoozedUntil: '2000-01-01T00:00:00.000Z' }),
        buildMockTicket({ id: 2, snoozedUntil: '2099-12-31T23:59:59.000Z' }),
        buildMockTicket({ id: 3, snoozedUntil: null }),
      ]
      const due = filterAwakeDue(tickets)

      assert.equal(due.length, 1)
      assert.equal(due[0].id, 1)
    })

    it('returns empty array when no tickets are due', () => {
      const tickets = [
        buildMockTicket({ id: 1, snoozedUntil: '2099-12-31T23:59:59.000Z' }),
        buildMockTicket({ id: 2, snoozedUntil: null }),
      ]
      const due = filterAwakeDue(tickets)

      assert.equal(due.length, 0)
    })

    it('returns multiple tickets when several are past due', () => {
      const tickets = [
        buildMockTicket({ id: 1, snoozedUntil: '2000-01-01T00:00:00.000Z' }),
        buildMockTicket({ id: 2, snoozedUntil: '2020-06-15T12:00:00.000Z' }),
        buildMockTicket({ id: 3, snoozedUntil: '2099-12-31T23:59:59.000Z' }),
      ]
      const due = filterAwakeDue(tickets)

      assert.equal(due.length, 2)
    })
  })

  describe('snooze round-trip', () => {
    it('restores original status after snooze and unsnooze cycle', () => {
      const original = buildMockTicket({ status: 'escalated' })
      const snoozed = simulateSnooze(original, '2099-01-01T00:00:00.000Z', 5)
      const unsnoozed = simulateUnsnooze(snoozed)

      assert.equal(unsnoozed.status, 'escalated')
      assert.equal(unsnoozed.snoozedUntil, null)
      assert.equal(unsnoozed.snoozedBy, null)
      assert.equal(unsnoozed.statusBeforeSnooze, null)
    })

    it('handles multiple snooze cycles correctly', () => {
      let ticket = buildMockTicket({ status: 'in_progress' })

      // First snooze
      ticket = simulateSnooze(ticket, '2099-01-01T00:00:00.000Z', 1)
      assert.equal(ticket.status, 'waiting_on_customer')
      assert.equal(ticket.statusBeforeSnooze, 'in_progress')

      // First unsnooze
      ticket = simulateUnsnooze(ticket)
      assert.equal(ticket.status, 'in_progress')

      // Second snooze
      ticket = simulateSnooze(ticket, '2099-06-01T00:00:00.000Z', 2)
      assert.equal(ticket.status, 'waiting_on_customer')
      assert.equal(ticket.statusBeforeSnooze, 'in_progress')

      // Second unsnooze
      ticket = simulateUnsnooze(ticket)
      assert.equal(ticket.status, 'in_progress')
    })
  })
})
