import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  articleExcerpt,
  isAgentReply,
  parseDepartmentId,
} from '../../src/support/widget_contract.ts'

/**
 * Small pieces of the shared widget's API contract: the excerpt under a search
 * result, which chat replies are the agent's, and the `department_id` the
 * widget posts (a number, a numeric string, or null when none is picked).
 */

describe('articleExcerpt', () => {
  it('turns an HTML body into a short line of text', () => {
    assert.equal(
      articleExcerpt('<p>Open <strong>Settings</strong>\n  and   choose Reset.</p>'),
      'Open Settings and choose Reset.'
    )
  })

  it('cuts long bodies at 150 characters', () => {
    const excerpt = articleExcerpt(`<p>${'word '.repeat(60)}</p>`)
    assert.ok(excerpt.length <= 153)
    assert.ok(excerpt.endsWith('...'))
  })

  it('is empty for a missing body', () => {
    assert.equal(articleExcerpt(null), '')
    assert.equal(articleExcerpt(''), '')
  })
})

describe('isAgentReply', () => {
  it('treats replies from the guest visitor as the visitor', () => {
    assert.equal(isAgentReply({ authorType: null, authorId: null }, { visitorId: null }), false)
    assert.equal(isAgentReply({ authorType: 'Guest', authorId: 0 }, { visitorId: null }), false)
  })

  it('treats replies from a signed-in visitor as the visitor', () => {
    assert.equal(isAgentReply({ authorType: 'User', authorId: 7 }, { visitorId: 7 }), false)
  })

  it('treats replies from a host user other than the visitor as the agent', () => {
    assert.equal(isAgentReply({ authorType: 'User', authorId: 2 }, { visitorId: null }), true)
    assert.equal(isAgentReply({ authorType: 'User', authorId: 2 }, { visitorId: 7 }), true)
  })
})

describe('parseDepartmentId', () => {
  it('reads a positive integer or numeric string', () => {
    assert.equal(parseDepartmentId(3), 3)
    assert.equal(parseDepartmentId('12'), 12)
  })

  it('is null when no usable department was sent', () => {
    for (const value of [null, undefined, '', 0, -1, 1.5, 'abc', '3abc', {}, [], true]) {
      assert.equal(parseDepartmentId(value), null, JSON.stringify(value))
    }
  })
})
