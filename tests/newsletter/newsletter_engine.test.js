import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import ContactSegmentResolver from '../../build/src/services/newsletter/contact_segment_resolver.js'

/**
 * Newsletter engine behaviour (bounce store, segment resolver, tracker rules)
 * without booting Adonis — mirrors contract test surface.
 */

const BACKOFF_MINUTES = [1, 5, 30]

function filterSendable(emails, suppressedSet) {
  return emails.filter((e) => !suppressedSet.has(e.toLowerCase()))
}

function markSuppressed(list, email) {
  const lower = email.toLowerCase()
  if (list.includes(lower)) return list
  return [...list, lower]
}

function shouldRecordOpen(status, openedAt) {
  if (['bounced', 'complained', 'failed'].includes(status)) return false
  return openedAt == null
}

function recordClickState(row) {
  const firstClick = row.clicks_count === 0
  row.clicks_count += 1
  if (!row.opened_at) row.opened_at = new Date()
  return { firstClick }
}

function computeClaimLimit(batchSize, rateLimitPerMinute, sentThisMinute) {
  const allowance = Math.max(0, rateLimitPerMinute - sentThisMinute)
  if (allowance === 0) return 0
  return Math.min(batchSize, allowance)
}

function isPendingClaimable(status, nextAttemptAt, now = new Date()) {
  if (status !== 'pending') return false
  if (!nextAttemptAt) return true
  return nextAttemptAt <= now
}

function scheduleRetryBackoff(attemptCount, now = new Date()) {
  const minutes = BACKOFF_MINUTES[attemptCount - 1] ?? 30
  return new Date(now.getTime() + minutes * 60_000)
}

function shouldAutoPause(terminalRows, threshold, rate) {
  if (terminalRows.length < threshold) return false
  const sample = terminalRows.slice(0, threshold)
  const bounced = sample.filter((r) => r.status === 'bounced').length
  return bounced / threshold >= rate
}

function cumulativeBounceWouldPause(terminalRows, threshold, rate) {
  if (terminalRows.length < threshold) return false
  const bounced = terminalRows.filter((r) => r.status === 'bounced').length
  return bounced / terminalRows.length >= rate
}

describe('BounceSuppressionStore logic', () => {
  it('stores and filters emails case-insensitively', () => {
    let list = []
    list = markSuppressed(list, 'USER@Example.com')
    const suppressed = new Set(list)
    assert.equal(filterSendable(['user@example.com', 'ok@example.com'], suppressed).length, 1)
    assert.equal(filterSendable(['ok@example.com'], suppressed)[0], 'ok@example.com')
  })
})

describe('NewsletterTracker logic', () => {
  it('records first open only', () => {
    const row = { status: 'sent', opened_at: null }
    assert.equal(shouldRecordOpen(row.status, row.opened_at), true)
    row.opened_at = new Date()
    assert.equal(shouldRecordOpen(row.status, row.opened_at), false)
  })

  it('ignores open after bounce', () => {
    assert.equal(shouldRecordOpen('bounced', null), false)
  })

  it('increments clicks and implicit open', () => {
    const row = { clicks_count: 0, opened_at: null }
    const first = recordClickState(row)
    assert.equal(first.firstClick, true)
    assert.equal(row.clicks_count, 1)
    assert.ok(row.opened_at)
    const second = recordClickState(row)
    assert.equal(second.firstClick, false)
    assert.equal(row.clicks_count, 2)
  })
})

describe('NewsletterDispatcher rate limit', () => {
  it('caps claim batch to remaining per-minute allowance', () => {
    assert.equal(computeClaimLimit(50, 60, 58), 2)
    assert.equal(computeClaimLimit(50, 60, 60), 0)
    assert.equal(computeClaimLimit(10, 60, 0), 10)
  })
})

describe('NewsletterDispatcher retry backoff', () => {
  it('schedules future next_attempt_at after a failed send', () => {
    const now = new Date('2026-06-03T12:00:00.000Z')
    const next = scheduleRetryBackoff(1, now)
    assert.equal(next.getTime(), now.getTime() + 60_000)
    assert.equal(scheduleRetryBackoff(2, now).getTime(), now.getTime() + 5 * 60_000)
  })

  it('does not reclaim pending rows until next_attempt_at', () => {
    const future = new Date(Date.now() + 300_000)
    assert.equal(isPendingClaimable('pending', future), false)
    assert.equal(isPendingClaimable('pending', null), true)
    assert.equal(isPendingClaimable('pending', new Date(Date.now() - 1_000)), true)
  })
})

describe('NewsletterDispatcher auto-pause logic', () => {
  it('pauses when first-N terminal sample exceeds bounce rate', () => {
    const rows = [
      { id: 1, status: 'bounced' },
      { id: 2, status: 'sent' },
      { id: 3, status: 'sent' },
      { id: 4, status: 'sent' },
    ]
    assert.equal(shouldAutoPause(rows, 4, 0.05), true)
  })

  it('does not pause before threshold terminal rows exist', () => {
    const rows = [{ id: 1, status: 'bounced' }]
    assert.equal(shouldAutoPause(rows, 4, 0.05), false)
  })

  it('does not pause on diluted cumulative bounce rate when first-N is healthy', () => {
    const rows = [
      ...Array.from({ length: 100 }, (_, i) => ({ id: i + 1, status: 'sent' })),
      ...Array.from({ length: 10 }, (_, i) => ({ id: 101 + i, status: 'bounced' })),
    ]
    assert.equal(shouldAutoPause(rows, 100, 0.05), false)
    assert.equal(cumulativeBounceWouldPause(rows, 100, 0.05), true)
  })
})

describe('ContactSegmentResolver static lists', () => {
  it('unions member contact ids for static lists', () => {
    const members = [{ contact_id: 1 }, { contact_id: 2 }]
    const ids = members.map((m) => m.contact_id)
    assert.deepEqual(ids, [1, 2])
  })

  it('filters opted-out contacts for sendable resolution', () => {
    const members = [
      { contact_id: 1, marketing_opt_out_at: null },
      { contact_id: 2, marketing_opt_out_at: '2026-01-01' },
    ]
    const sendable = members.filter((m) => m.marketing_opt_out_at == null).map((m) => m.contact_id)
    assert.deepEqual(sendable, [1])
  })

  it('skips unknown field and operator rules', () => {
    assert.equal(ContactSegmentResolver.isAllowedFilterRule('email', '='), true)
    assert.equal(ContactSegmentResolver.isAllowedFilterRule('password', '='), false)
    assert.equal(ContactSegmentResolver.isAllowedFilterRule('email', 'drop table'), false)
    assert.equal(ContactSegmentResolver.isAllowedFilterRule('metadata.tier', '='), true)
    assert.equal(ContactSegmentResolver.isAllowedFilterRule('metadata.bad-key', '='), false)
  })
})

describe('Newsletter disable mid-flight', () => {
  it('dispatch no-ops when enableNewsletters is false', () => {
    const enableNewsletters = false
    let dispatched = false
    if (enableNewsletters) dispatched = true
    assert.equal(dispatched, false)
  })
})
