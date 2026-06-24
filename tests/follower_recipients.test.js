import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { followerRecipients } from '../src/services/follower_recipients.ts'

/*
|--------------------------------------------------------------------------
| Follower recipients
|--------------------------------------------------------------------------
|
| The package abstracts the host user table, so it cannot email follower
| users directly. It resolves the recipient user ids (excluding the actor,
| de-duplicated) and rides them on the reply/status events for the host to
| fan out. See issue #94.
|
*/

describe('followerRecipients', () => {
  it('excludes the actor and de-duplicates, preserving order', () => {
    assert.deepEqual(followerRecipients([7, 2, 7, 3], 2), [7, 3])
  })

  it('returns all (de-duplicated) when no actor is excluded', () => {
    assert.deepEqual(followerRecipients([7, 3, 7], undefined), [7, 3])
  })

  it('supports string (uuid) user ids', () => {
    assert.deepEqual(followerRecipients(['a', 'b', 'a'], 'b'), ['a'])
  })
})
