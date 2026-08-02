import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AUDIT_ACTIONS,
  DEFAULT_AUDIT_EXCLUDE,
  buildAuditEntry,
  diffAuditable,
  filterAuditLogs,
  sortAuditLogsDesc,
} from '../../src/support/audit_events.ts'

/*
|--------------------------------------------------------------------------
| System audit log — unit tests
|--------------------------------------------------------------------------
|
| Ports the Laravel `Auditable` trait + `Admin\AuditLogController` contract.
| Like the rest of the escalated-adonis suite these are pure-function tests:
| the framework-free logic the audit service and admin controller delegate to
| lives in `src/support/audit_events.ts`, so we can prove the row shape and the
| list filter/sort semantics without Lucid or HTTP. Integration coverage lives
| in the host-app harness.
|
*/

describe('buildAuditEntry — a recorded action becomes an audit row', () => {
  it('captures the actor, action, and target of a mutation', () => {
    const entry = buildAuditEntry({
      userId: 7,
      action: AUDIT_ACTIONS.WEBHOOK_CREATED,
      auditableType: 'Webhook',
      auditableId: 42,
      newValues: { url: 'https://example.test/hook', active: true },
      ipAddress: '203.0.113.9',
      userAgent: 'jest/1',
    })

    // actor
    assert.equal(entry.userId, 7)
    // action
    assert.equal(entry.action, 'webhook.created')
    // target (auditable_type / auditable_id) — id stringified for key-type parity
    assert.equal(entry.auditableType, 'Webhook')
    assert.equal(entry.auditableId, '42')
    // payload
    assert.deepEqual(entry.newValues, { url: 'https://example.test/hook', active: true })
    assert.equal(entry.oldValues, null)
    // request context
    assert.equal(entry.ipAddress, '203.0.113.9')
    assert.equal(entry.userAgent, 'jest/1')
  })

  it('records an anonymous / system action with a null actor', () => {
    const entry = buildAuditEntry({ action: 'settings.updated' })
    assert.equal(entry.userId, null)
    assert.equal(entry.action, 'settings.updated')
    assert.equal(entry.auditableType, null)
    assert.equal(entry.auditableId, null)
  })

  it('preserves a string / uuid target id and stringifies numeric ids', () => {
    const uuid = buildAuditEntry({ action: 'user.role_updated', auditableId: 'a1b2-c3d4' })
    assert.equal(uuid.auditableId, 'a1b2-c3d4')

    const numeric = buildAuditEntry({ action: 'user.role_updated', auditableId: 10 })
    assert.equal(numeric.auditableId, '10')
    assert.equal(typeof numeric.auditableId, 'string')
  })

  it('collapses empty old/new value maps to null', () => {
    const entry = buildAuditEntry({
      action: 'automation.deleted',
      oldValues: {},
      newValues: {},
    })
    assert.equal(entry.oldValues, null)
    assert.equal(entry.newValues, null)
  })
})

describe('diffAuditable — auto-recorded model changes', () => {
  it('records only the keys that actually changed, old and new', () => {
    const original = { name: 'Old', active: true, position: 3 }
    const changed = { name: 'New', active: true }

    const { oldValues, newValues } = diffAuditable(original, changed)
    assert.deepEqual(oldValues, { name: 'Old' })
    assert.deepEqual(newValues, { name: 'New' })
  })

  it('excludes timestamp noise columns by default', () => {
    const original = { name: 'A', updated_at: '2026-01-01', createdAt: '2026-01-01' }
    const changed = { name: 'B', updated_at: '2026-02-02', createdAt: '2026-01-01' }

    const { oldValues, newValues } = diffAuditable(original, changed, DEFAULT_AUDIT_EXCLUDE)
    assert.deepEqual(oldValues, { name: 'A' })
    assert.deepEqual(newValues, { name: 'B' })
  })

  it('yields null maps when nothing meaningful changed', () => {
    const original = { name: 'Same', updated_at: '2026-01-01' }
    const changed = { name: 'Same', updated_at: '2026-09-09' }

    const { oldValues, newValues } = diffAuditable(original, changed)
    assert.equal(oldValues, null)
    assert.equal(newValues, null)
  })
})

describe('AUDIT_ACTIONS — catalogue covers the wired surface', () => {
  it('names every admin + security action the wiring emits', () => {
    const values = Object.values(AUDIT_ACTIONS)
    for (const action of [
      'settings.updated',
      'user.role_updated',
      'webhook.created',
      'webhook.updated',
      'webhook.deleted',
      'api_token.created',
      'api_token.revoked',
      'automation.created',
      'automation.updated',
      'automation.deleted',
      'two_factor.enabled',
      'two_factor.disabled',
    ]) {
      assert.ok(values.includes(action as any), `missing audit action: ${action}`)
    }
  })

  it('has no duplicate action names', () => {
    const values = Object.values(AUDIT_ACTIONS)
    assert.equal(new Set(values).size, values.length)
  })
})

describe('filterAuditLogs — the admin list returns and filters entries', () => {
  const rows = [
    {
      userId: 1,
      action: 'webhook.created',
      auditableType: 'Webhook',
      createdAt: '2026-03-10T09:00:00.000Z',
    },
    {
      userId: 2,
      action: 'two_factor.enabled',
      auditableType: 'TwoFactor',
      createdAt: '2026-03-15T12:00:00.000Z',
    },
    {
      userId: 1,
      action: 'settings.updated',
      auditableType: 'settings',
      createdAt: '2026-03-20T18:00:00.000Z',
    },
  ]

  it('returns every row when no filters are set', () => {
    assert.equal(filterAuditLogs(rows, {}).length, 3)
  })

  it('filters by actor (with int/string coercion)', () => {
    assert.equal(filterAuditLogs(rows, { userId: 1 }).length, 2)
    assert.equal(filterAuditLogs(rows, { userId: '1' }).length, 2)
    assert.equal(filterAuditLogs(rows, { userId: 2 }).length, 1)
  })

  it('filters by action name', () => {
    const out = filterAuditLogs(rows, { action: 'two_factor.enabled' })
    assert.equal(out.length, 1)
    assert.equal(out[0].userId, 2)
  })

  it('filters by auditable (resource) type', () => {
    const out = filterAuditLogs(rows, { auditableType: 'Webhook' })
    assert.equal(out.length, 1)
    assert.equal(out[0].action, 'webhook.created')
  })

  it('filters by an inclusive date range', () => {
    // dateTo is inclusive of the whole day — the 15th row must be kept.
    const out = filterAuditLogs(rows, { dateFrom: '2026-03-11', dateTo: '2026-03-15' })
    assert.equal(out.length, 1)
    assert.equal(out[0].action, 'two_factor.enabled')
  })

  it('ANDs multiple filters together', () => {
    const out = filterAuditLogs(rows, { userId: 1, auditableType: 'settings' })
    assert.equal(out.length, 1)
    assert.equal(out[0].action, 'settings.updated')

    assert.equal(filterAuditLogs(rows, { userId: 2, auditableType: 'settings' }).length, 0)
  })

  it('sorts newest-first', () => {
    const sorted = sortAuditLogsDesc(rows)
    assert.deepEqual(
      sorted.map((r) => r.action),
      ['settings.updated', 'two_factor.enabled', 'webhook.created']
    )
  })
})
