import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Admin Users Controller Tests
|--------------------------------------------------------------------------
|
| Mirrors the Laravel reference (`tests/Feature/Admin/UserControllerTest.php`
| in escalated-laravel) for feature parity. Like the rest of the
| escalated-adonis test suite, these are pure-function tests: we re-implement
| the controller's decision logic (role-flip semantics, self-demote guard,
| list ordering, search filter) and assert on the resulting state — no
| Lucid / no HTTP. Integration coverage lives in the host-app harness.
|
*/

// ──────────────────────────────────────────────────────────────────
// Re-implement controller helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Decide what to do for `updateRole({ role, value })` against a target
 * user, given the authenticated admin's id. Returns one of:
 *   - `{ action: 'forbid_self_demote' }`            — admin demoting self
 *   - `{ action: 'invalid_role' }`                  — role !== admin|agent
 *   - `{ action: 'update', updates: { is_admin?, is_agent? } }`
 *
 * Mirrors AdminUsersController.updateRole().
 */
function decideRoleUpdate(target, role, value, authUserId) {
  if (role !== 'admin' && role !== 'agent') {
    return { action: 'invalid_role' }
  }

  if (
    role === 'admin' &&
    !value &&
    authUserId !== null &&
    String(authUserId) === String(target.id)
  ) {
    return { action: 'forbid_self_demote' }
  }

  const updates = {}
  if (role === 'admin') {
    updates.is_admin = value
    if (value) {
      // Admins are agents; promoting to admin auto-enables agent.
      updates.is_agent = true
    }
  } else {
    updates.is_agent = value
    if (!value && target.is_admin) {
      // Revoking agent from an admin: also demote admin to avoid a
      // confusing "admin gate on, agent gate off" state.
      updates.is_admin = false
    }
  }
  return { action: 'update', updates }
}

/**
 * Re-implement the index() ordering — `is_admin DESC`, `is_agent DESC`,
 * `id ASC`. Returns a copy sorted in-place.
 */
function sortUsers(users) {
  return [...users].sort((a, b) => {
    if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1
    if (a.is_agent !== b.is_agent) return a.is_agent ? -1 : 1
    return a.id - b.id
  })
}

/**
 * Re-implement the index() search filter — case-insensitive substring
 * match against `email` OR (`name` if present).
 */
function searchUsers(users, term) {
  if (!term) return users
  const needle = term.toLowerCase()
  return users.filter((u) => {
    if (typeof u.email === 'string' && u.email.toLowerCase().includes(needle)) return true
    if (typeof u.name === 'string' && u.name.toLowerCase().includes(needle)) return true
    return false
  })
}

/**
 * Apply an `updates` object (as returned by decideRoleUpdate) to a target
 * user and return the result.
 */
function applyUpdates(target, updates) {
  return { ...target, ...updates }
}

// ──────────────────────────────────────────────────────────────────
// Tests — one per parity case from the Laravel reference suite
// ──────────────────────────────────────────────────────────────────

describe('Admin Users — list', () => {
  it('lists users with their admin/agent flags', () => {
    // Mirrors: "lists users with their admin/agent flags for an admin"
    const users = [
      { id: 1, name: 'Admin', email: 'admin@example.com', is_admin: true, is_agent: true },
      { id: 2, name: 'Customer', email: 'customer@example.com', is_admin: false, is_agent: false },
      { id: 3, name: 'Agent', email: 'agent@example.com', is_admin: false, is_agent: true },
    ]
    const sorted = sortUsers(users)
    const emails = sorted.map((u) => u.email)
    assert.ok(emails.includes('admin@example.com'))
    assert.ok(emails.includes('customer@example.com'))
    assert.ok(emails.includes('agent@example.com'))
    // Admins surface first, then agents, then customers.
    assert.equal(sorted[0].email, 'admin@example.com')
    assert.equal(sorted[1].email, 'agent@example.com')
    assert.equal(sorted[2].email, 'customer@example.com')
  })

  it('filters users by search term against name or email', () => {
    // Mirrors: "filters users by search term"
    const users = [
      { id: 1, name: 'Admin', email: 'admin@example.com', is_admin: true, is_agent: true },
      { id: 2, name: 'Jane Doe', email: 'jane@acme.test', is_admin: false, is_agent: false },
      { id: 3, name: 'Bob Smith', email: 'bob@globex.test', is_admin: false, is_agent: false },
    ]
    const filtered = searchUsers(users, 'acme')
    const emails = filtered.map((u) => u.email)
    assert.ok(emails.includes('jane@acme.test'))
    assert.ok(!emails.includes('bob@globex.test'))
  })
})

describe('Admin Users — role gate', () => {
  it('blocks non-admins from the user list at the middleware layer', () => {
    // Mirrors: "blocks non-admins from the user list"
    //
    // The actual gate is enforced by `EnsureIsAdmin` middleware (mounted
    // on the `/support/admin` group in `start/routes.ts`), which calls
    // `config.authorization.isAdmin(user)` and 403s on false. We mirror
    // that decision here.
    function ensureIsAdmin(user, isAdminCheck) {
      if (!user) return { status: 403 }
      return isAdminCheck(user) ? { status: 200 } : { status: 403 }
    }
    const isAdminCheck = (u) => Boolean(u.is_admin)

    const agent = { id: 1, is_admin: false, is_agent: true }
    const admin = { id: 2, is_admin: true, is_agent: true }

    assert.equal(ensureIsAdmin(agent, isAdminCheck).status, 403)
    assert.equal(ensureIsAdmin(admin, isAdminCheck).status, 200)
    assert.equal(ensureIsAdmin(null, isAdminCheck).status, 403)
  })
})

describe('Admin Users — updateRole', () => {
  it('promotes a user to admin (and forces is_agent=true)', () => {
    // Mirrors: "promotes a user to admin via the panel"
    const target = { id: 10, is_admin: false, is_agent: false }
    const decision = decideRoleUpdate(target, 'admin', true, 1)

    assert.equal(decision.action, 'update')
    assert.equal(decision.updates.is_admin, true)
    assert.equal(decision.updates.is_agent, true)

    const after = applyUpdates(target, decision.updates)
    assert.equal(after.is_admin, true)
    assert.equal(after.is_agent, true)
  })

  it('promotes a user to agent only (is_admin stays false)', () => {
    // Mirrors: "promotes a user to agent only"
    const target = { id: 10, is_admin: false, is_agent: false }
    const decision = decideRoleUpdate(target, 'agent', true, 1)

    assert.equal(decision.action, 'update')
    assert.equal(decision.updates.is_agent, true)
    assert.equal(decision.updates.is_admin, undefined)

    const after = applyUpdates(target, decision.updates)
    assert.equal(after.is_agent, true)
    assert.equal(after.is_admin, false)
  })

  it('prevents admins from demoting themselves', () => {
    // Mirrors: "prevents admins from demoting themselves"
    const admin = { id: 1, is_admin: true, is_agent: true }
    const decision = decideRoleUpdate(admin, 'admin', false, 1)

    assert.equal(decision.action, 'forbid_self_demote')

    // No updates applied — admin keeps their flags.
    const after = decision.updates ? applyUpdates(admin, decision.updates) : admin
    assert.equal(after.is_admin, true)
  })

  it('lets a different admin demote a target admin (no self-guard tripped)', () => {
    // Edge case under the same code path: the self-guard must only fire
    // when authUserId === target.id, not for every admin-demote.
    const target = { id: 2, is_admin: true, is_agent: true }
    const decision = decideRoleUpdate(target, 'admin', false, 1)

    assert.equal(decision.action, 'update')
    assert.equal(decision.updates.is_admin, false)
    // is_agent NOT touched by an admin-off flip (an ex-admin can still
    // answer tickets unless explicitly demoted as an agent).
    assert.equal(decision.updates.is_agent, undefined)
  })

  it('demotes an admin and turns off agent in one step', () => {
    // Mirrors: "demotes an admin and turns off agent in one step"
    //
    // Revoking the agent role from someone who is also an admin must
    // also clear is_admin so the admin gate doesn't stay on while the
    // agent gate is off.
    const target = { id: 2, is_admin: true, is_agent: true }
    const decision = decideRoleUpdate(target, 'agent', false, 1)

    assert.equal(decision.action, 'update')
    assert.equal(decision.updates.is_agent, false)
    assert.equal(decision.updates.is_admin, false)

    const after = applyUpdates(target, decision.updates)
    assert.equal(after.is_agent, false)
    assert.equal(after.is_admin, false)
  })

  it('demoting a non-admin agent does not touch is_admin', () => {
    // Same code path, opposite branch: target is a plain agent (not
    // admin) — turning their agent flag off must leave is_admin alone.
    const target = { id: 3, is_admin: false, is_agent: true }
    const decision = decideRoleUpdate(target, 'agent', false, 1)

    assert.equal(decision.action, 'update')
    assert.equal(decision.updates.is_agent, false)
    assert.equal(decision.updates.is_admin, undefined)
  })

  it('rejects unknown role values', () => {
    const target = { id: 3, is_admin: false, is_agent: false }
    const decision = decideRoleUpdate(target, 'superadmin', true, 1)
    assert.equal(decision.action, 'invalid_role')
  })
})
