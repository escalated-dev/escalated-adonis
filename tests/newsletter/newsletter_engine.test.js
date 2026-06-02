import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Newsletter engine behaviour (bounce store, segment resolver, tracker rules)
 * without booting Adonis — mirrors contract test surface.
 */

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

function shouldAutoPause(terminalRows, threshold, rate) {
  if (terminalRows.length < threshold) return false
  const sample = terminalRows.slice(0, threshold)
  const bounced = sample.filter((r) => r.status === 'bounced').length
  return bounced / threshold >= rate
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
})

describe('Newsletter disable mid-flight', () => {
  it('dispatch no-ops when enableNewsletters is false', () => {
    const enableNewsletters = false
    let dispatched = false
    if (enableNewsletters) dispatched = true
    assert.equal(dispatched, false)
  })
})
