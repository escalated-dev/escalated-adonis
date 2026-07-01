import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runAuthCallback, bearerToken } from '../../src/helpers/api_auth.ts'

describe('api auth host-callback helper', () => {
  it('returns 501 when no callback is configured', async () => {
    const { status, body } = await runAuthCallback(undefined, { email: 'a@b.com' })
    assert.equal(status, 501)
    assert.deepEqual(body, { error: 'Authentication is not configured' })
  })

  it('returns 200 with {data} when the callback resolves a user', async () => {
    const authenticate = (p: any) => ({ token: 'abc', email: p.email })
    const { status, body } = await runAuthCallback(authenticate, { email: 'a@b.com' })
    assert.equal(status, 200)
    assert.deepEqual(body, { data: { token: 'abc', email: 'a@b.com' } })
  })

  it('returns 401 when the callback resolves null', async () => {
    const { status, body } = await runAuthCallback(() => null, { email: 'x' })
    assert.equal(status, 401)
    assert.deepEqual(body, { error: 'Unauthorized' })
  })

  it('awaits async callbacks', async () => {
    const authenticate = async (p: any) => ({ id: p.id })
    const { status, body } = await runAuthCallback(authenticate, { id: 42 })
    assert.equal(status, 200)
    assert.deepEqual(body, { data: { id: 42 } })
  })

  it('strips the Bearer prefix from an authorization header', () => {
    assert.equal(bearerToken('Bearer tok123'), 'tok123')
    assert.equal(bearerToken('raw-token'), 'raw-token')
    assert.equal(bearerToken(undefined), '')
  })
})
