import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Contact Model — Pure-Function Tests
|--------------------------------------------------------------------------
|
| Adonis unit tests avoid booting Lucid / a database. We re-implement
| the pure-function parts of the Contact model (email normalization,
| find-or-create decision tree) and assert on those.
|
| Integration tests against the real Lucid model live in the
| integration suite (separate harness).
*/

// ──────────────────────────────────────────────────────────────────
// Re-implement Contact's pure helpers
// ──────────────────────────────────────────────────────────────────

function normalizeEmail(email) {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Decides what to do given an incoming (email, name) and an
 * existing Contact row (if any). Returns the action the model
 * will take: 'return-existing', 'update-name', or 'create'.
 */
function decideAction(existing, incomingName) {
  if (existing) {
    if (!existing.name && incomingName) return 'update-name'
    return 'return-existing'
  }
  return 'create'
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('normalizeEmail', () => {
  it('lowercases', () => {
    assert.equal(normalizeEmail('ALICE@EXAMPLE.com'), 'alice@example.com')
  })

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeEmail('  alice@example.com  '), 'alice@example.com')
  })

  it('does both in one pass', () => {
    assert.equal(normalizeEmail('  MiXeD@Case.COM  '), 'mixed@case.com')
  })

  it('returns empty string for null / undefined', () => {
    assert.equal(normalizeEmail(null), '')
    assert.equal(normalizeEmail(undefined), '')
  })
})

describe('decideAction (findOrCreateByEmail branch selection)', () => {
  it('returns create when no existing row', () => {
    assert.equal(decideAction(null, 'Alice'), 'create')
  })

  it('returns return-existing when existing has non-blank name', () => {
    assert.equal(decideAction({ name: 'Alice' }, 'Different'), 'return-existing')
  })

  it('returns update-name when existing name is blank and a name is supplied', () => {
    assert.equal(decideAction({ name: null }, 'Alice'), 'update-name')
    assert.equal(decideAction({ name: '' }, 'Alice'), 'update-name')
  })

  it('returns return-existing when existing name is blank but no name supplied', () => {
    assert.equal(decideAction({ name: null }, null), 'return-existing')
    assert.equal(decideAction({ name: null }, undefined), 'return-existing')
  })
})
