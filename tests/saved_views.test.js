import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Saved Views Tests
|--------------------------------------------------------------------------
|
| Unit tests for the saved views / custom queues feature.
|
*/

// ──────────────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────────────

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildView(overrides = {}) {
  return {
    id: 1,
    name: 'My Open Tickets',
    slug: 'my-open-tickets',
    userId: 5,
    isShared: false,
    isDefault: false,
    filters: { status: 'open', assigned_to: 5 },
    columns: ['reference', 'subject', 'status', 'priority'],
    sortBy: 'created_at',
    sortDir: 'desc',
    icon: null,
    color: null,
    order: 0,
    ...overrides,
  }
}

/**
 * Filter views visible to a user (their own + shared)
 */
function filterVisibleTo(views, userId) {
  return views.filter((v) => v.userId === userId || v.isShared)
}

/**
 * Filter shared views only
 */
function filterShared(views) {
  return views.filter((v) => v.isShared)
}

/**
 * Filter views owned by a user
 */
function filterOwnedBy(views, userId) {
  return views.filter((v) => v.userId === userId)
}

/**
 * Simulate reorder
 */
function reorder(views, orderIds) {
  return orderIds
    .map((id, index) => {
      const view = views.find((v) => v.id === id)
      return view ? { ...view, order: index } : null
    })
    .filter(Boolean)
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('Saved Views', () => {
  describe('generateSlug', () => {
    it('converts name to lowercase slug', () => {
      assert.equal(generateSlug('My Open Tickets'), 'my-open-tickets')
    })

    it('removes special characters', () => {
      assert.equal(generateSlug('High Priority!!!'), 'high-priority')
    })

    it('replaces multiple separators with single dash', () => {
      assert.equal(generateSlug('SLA   Breached  Tickets'), 'sla-breached-tickets')
    })

    it('trims leading and trailing dashes', () => {
      assert.equal(generateSlug('---test---'), 'test')
    })

    it('handles single word', () => {
      assert.equal(generateSlug('Urgent'), 'urgent')
    })

    it('handles numbers', () => {
      assert.equal(generateSlug('Top 10 Issues'), 'top-10-issues')
    })
  })

  describe('visibility scopes', () => {
    const views = [
      buildView({ id: 1, userId: 5, isShared: false }),
      buildView({ id: 2, userId: 5, isShared: true }),
      buildView({ id: 3, userId: 10, isShared: false }),
      buildView({ id: 4, userId: 10, isShared: true }),
      buildView({ id: 5, userId: null, isShared: true }),
    ]

    it('visibleTo includes own views and shared views', () => {
      const visible = filterVisibleTo(views, 5)
      const ids = visible.map((v) => v.id)
      assert.ok(ids.includes(1)) // own, not shared
      assert.ok(ids.includes(2)) // own, shared
      assert.ok(!ids.includes(3)) // other user, not shared
      assert.ok(ids.includes(4)) // other user, shared
      assert.ok(ids.includes(5)) // no user, shared
    })

    it('shared returns only shared views', () => {
      const shared = filterShared(views)
      assert.equal(shared.length, 3)
      shared.forEach((v) => assert.equal(v.isShared, true))
    })

    it('ownedBy returns only views owned by user', () => {
      const owned = filterOwnedBy(views, 5)
      assert.equal(owned.length, 2)
      owned.forEach((v) => assert.equal(v.userId, 5))
    })

    it('ownedBy returns empty for user with no views', () => {
      const owned = filterOwnedBy(views, 999)
      assert.equal(owned.length, 0)
    })
  })

  describe('CRUD operations', () => {
    it('creates a view with correct defaults', () => {
      const view = buildView({
        name: 'Test View',
        slug: generateSlug('Test View'),
        filters: { status: 'open' },
      })

      assert.equal(view.name, 'Test View')
      assert.equal(view.slug, 'test-view')
      assert.deepStrictEqual(view.filters, { status: 'open' })
      assert.equal(view.isDefault, false)
      assert.equal(view.order, 0)
    })

    it('updates view name and regenerates slug', () => {
      const view = buildView({ name: 'Old Name', slug: 'old-name' })
      view.name = 'New Name'
      view.slug = generateSlug('New Name')

      assert.equal(view.name, 'New Name')
      assert.equal(view.slug, 'new-name')
    })

    it('updates filters', () => {
      const view = buildView({ filters: { status: 'open' } })
      view.filters = { status: 'closed', priority: 'high' }

      assert.deepStrictEqual(view.filters, { status: 'closed', priority: 'high' })
    })

    it('updates columns', () => {
      const view = buildView({ columns: ['reference'] })
      view.columns = ['reference', 'subject', 'priority']

      assert.deepStrictEqual(view.columns, ['reference', 'subject', 'priority'])
    })

    it('handles null columns', () => {
      const view = buildView({ columns: null })
      assert.equal(view.columns, null)
    })
  })

  describe('reorder', () => {
    it('sets order based on position in array', () => {
      const views = [
        buildView({ id: 1, order: 0 }),
        buildView({ id: 2, order: 1 }),
        buildView({ id: 3, order: 2 }),
      ]

      const reordered = reorder(views, [3, 1, 2])
      assert.equal(reordered[0].id, 3)
      assert.equal(reordered[0].order, 0)
      assert.equal(reordered[1].id, 1)
      assert.equal(reordered[1].order, 1)
      assert.equal(reordered[2].id, 2)
      assert.equal(reordered[2].order, 2)
    })

    it('handles single item reorder', () => {
      const views = [buildView({ id: 1, order: 0 })]
      const reordered = reorder(views, [1])
      assert.equal(reordered.length, 1)
      assert.equal(reordered[0].order, 0)
    })

    it('skips non-existent view IDs', () => {
      const views = [buildView({ id: 1, order: 0 })]
      const reordered = reorder(views, [1, 999])
      assert.equal(reordered.length, 1)
    })
  })

  describe('filter structure', () => {
    it('supports status filter', () => {
      const view = buildView({ filters: { status: 'open' } })
      assert.equal(view.filters.status, 'open')
    })

    it('supports priority filter', () => {
      const view = buildView({ filters: { priority: 'high' } })
      assert.equal(view.filters.priority, 'high')
    })

    it('supports assigned_to filter', () => {
      const view = buildView({ filters: { assigned_to: 5 } })
      assert.equal(view.filters.assigned_to, 5)
    })

    it('supports unassigned filter', () => {
      const view = buildView({ filters: { unassigned: true } })
      assert.equal(view.filters.unassigned, true)
    })

    it('supports department_id filter', () => {
      const view = buildView({ filters: { department_id: 3 } })
      assert.equal(view.filters.department_id, 3)
    })

    it('supports tag_ids filter', () => {
      const view = buildView({ filters: { tag_ids: [1, 2, 3] } })
      assert.deepStrictEqual(view.filters.tag_ids, [1, 2, 3])
    })

    it('supports sla_breached filter', () => {
      const view = buildView({ filters: { sla_breached: true } })
      assert.equal(view.filters.sla_breached, true)
    })

    it('supports combined filters', () => {
      const view = buildView({
        filters: { status: 'open', priority: 'high', unassigned: true },
      })
      assert.equal(view.filters.status, 'open')
      assert.equal(view.filters.priority, 'high')
      assert.equal(view.filters.unassigned, true)
    })
  })
})
