import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidChannel,
  SIDE_CONVERSATION_CHANNELS,
} from '../../src/support/side_conversation_channels.ts'

describe('side conversation channels', () => {
  it('accepts the canonical channels', () => {
    assert.equal(isValidChannel('internal'), true)
    assert.equal(isValidChannel('email'), true)
  })

  it('rejects unknown or empty channels', () => {
    assert.equal(isValidChannel('sms'), false)
    assert.equal(isValidChannel(''), false)
  })

  it('exposes exactly the two accepted channels', () => {
    assert.deepEqual([...SIDE_CONVERSATION_CHANNELS], ['internal', 'email'])
  })
})
