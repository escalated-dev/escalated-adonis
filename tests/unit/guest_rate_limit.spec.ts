import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  checkGuestRateLimit,
  MemoryGuestRateLimitStore,
  type GuestRateLimitConfig,
  type GuestRateLimitScope,
} from '../../src/support/guest_rate_limit.ts'

/**
 * The guest endpoints are unauthenticated and each accepted request writes rows
 * and sends mail, so they are capped per client IP: 5 ticket submissions and 10
 * replies per minute unless the host configures otherwise.
 */

async function hit(
  config: GuestRateLimitConfig,
  scope: GuestRateLimitScope,
  ip: string,
  times: number
) {
  const out: boolean[] = []
  for (let i = 0; i < times; i++) {
    const { allowed } = await checkGuestRateLimit(config, scope, ip)
    out.push(allowed)
  }
  return out
}

describe('checkGuestRateLimit', () => {
  it('allows 5 ticket submissions per IP per minute and refuses the 6th', async () => {
    const config = { store: new MemoryGuestRateLimitStore() }

    assert.deepEqual(await hit(config, 'ticket', '203.0.113.1', 6), [
      true,
      true,
      true,
      true,
      true,
      false,
    ])
  })

  it('allows 10 replies per IP per minute and refuses the 11th', async () => {
    const out = await hit({ store: new MemoryGuestRateLimitStore() }, 'reply', '203.0.113.1', 11)

    assert.deepEqual(out, [...Array(10).fill(true), false])
  })

  it('keys each client IP separately', async () => {
    const config = { store: new MemoryGuestRateLimitStore() }
    await hit(config, 'ticket', '203.0.113.1', 5)

    assert.deepEqual(await hit(config, 'ticket', '203.0.113.2', 1), [true])
  })

  it('counts ticket submissions and replies in separate buckets', async () => {
    const config = { store: new MemoryGuestRateLimitStore() }
    await hit(config, 'ticket', '203.0.113.1', 5)

    assert.deepEqual(await hit(config, 'reply', '203.0.113.1', 1), [true])
  })

  it('honours configured limits and keeps the default for one left unset', async () => {
    const config = { store: new MemoryGuestRateLimitStore(), repliesPerMinute: 1 }

    assert.deepEqual(await hit(config, 'reply', '203.0.113.1', 2), [true, false])
    const tickets = await hit(config, 'ticket', '203.0.113.1', 6)
    assert.equal(tickets.filter(Boolean).length, 5)
  })

  it('never refuses when disabled', async () => {
    const config = { store: new MemoryGuestRateLimitStore(), enabled: false }

    const out = await hit(config, 'ticket', '203.0.113.1', 20)

    assert.ok(out.every(Boolean))
  })

  it('reports how long until the window resets, and resets after it', async () => {
    let now = 1_000_000
    const config = { store: new MemoryGuestRateLimitStore(() => now), ticketsPerMinute: 1 }
    await checkGuestRateLimit(config, 'ticket', '203.0.113.1')

    now += 15_000
    const refused = await checkGuestRateLimit(config, 'ticket', '203.0.113.1')
    assert.deepEqual(refused, { allowed: false, retryAfterSeconds: 45, limit: 1 })

    now += 45_000
    assert.deepEqual(await checkGuestRateLimit(config, 'ticket', '203.0.113.1'), {
      allowed: true,
    })
  })

  it('counts in a host-supplied store for multi-instance deployments', async () => {
    const calls: Array<[string, number]> = []
    const shared = {
      hit: async (key: string, windowMs: number) => {
        calls.push([key, windowMs])
        return { count: 11, resetInMs: 30_000 }
      },
    }

    const decision = await checkGuestRateLimit({ store: shared }, 'reply', '203.0.113.9')

    assert.deepEqual(calls, [['escalated:guest:reply:203.0.113.9', 60_000]])
    assert.deepEqual(decision, { allowed: false, retryAfterSeconds: 30, limit: 10 })
  })
})
