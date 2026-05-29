import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { userKeyType } from '../../build/src/helpers/user_id_column.js'

describe('user_id_column', () => {
  const envKey = 'ESCALATED_USER_KEY_TYPE'
  let saved: string | undefined

  beforeEach(() => {
    saved = process.env[envKey]
  })

  afterEach(() => {
    if (saved === undefined) {
      delete process.env[envKey]
    } else {
      process.env[envKey] = saved
    }
  })

  describe('userKeyType', () => {
    it('defaults to int when env is unset', () => {
      delete process.env[envKey]
      assert.equal(userKeyType(), 'int')
    })

    it('returns uuid when ESCALATED_USER_KEY_TYPE=uuid', () => {
      process.env[envKey] = 'uuid'
      assert.equal(userKeyType(), 'uuid')
    })
  })
})
