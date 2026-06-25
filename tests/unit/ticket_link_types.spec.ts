import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isValidLinkType, TICKET_LINK_TYPES } from '../../src/support/ticket_link_types.ts'

describe('ticket link types', () => {
  it('accepts the three canonical link types', () => {
    assert.equal(isValidLinkType('problem_incident'), true)
    assert.equal(isValidLinkType('parent_child'), true)
    assert.equal(isValidLinkType('related'), true)
  })

  it('rejects unknown or empty link types', () => {
    assert.equal(isValidLinkType('duplicate'), false)
    assert.equal(isValidLinkType(''), false)
  })

  it('exposes exactly the three accepted types', () => {
    assert.deepEqual([...TICKET_LINK_TYPES], ['problem_incident', 'parent_child', 'related'])
  })
})
