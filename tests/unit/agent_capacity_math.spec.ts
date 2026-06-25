import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasCapacity, loadPercentage } from '../../src/support/agent_capacity_math.ts'

describe('agent capacity math', () => {
  it('has capacity when below the ceiling', () => {
    assert.equal(hasCapacity(2, 3), true)
  })

  it('has no capacity at or over the ceiling', () => {
    assert.equal(hasCapacity(3, 3), false)
    assert.equal(hasCapacity(4, 3), false)
  })

  it('computes load percentage rounded to one decimal', () => {
    assert.equal(loadPercentage(3, 10), 30)
    assert.equal(loadPercentage(2, 8), 25)
    assert.equal(loadPercentage(1, 3), 33.3)
  })

  it('treats a zero ceiling as fully loaded', () => {
    assert.equal(loadPercentage(0, 0), 100)
  })
})
