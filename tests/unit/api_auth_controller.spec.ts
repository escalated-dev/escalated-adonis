import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import ApiAuthController from '../../src/controllers/api/api_auth_controller.ts'

function fakeCtx(body: Record<string, any> = {}, authHeader?: string) {
  const captured: { status?: number; body?: any } = {}
  const record = (status: number) => (payload: any) => {
    captured.status = status
    captured.body = payload
    return captured
  }
  const ctx = {
    request: {
      body: () => body,
      header: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : undefined),
    },
    response: {
      json: record(200),
      unauthorized: record(401),
      notImplemented: record(501),
    },
  } as any
  return { ctx, captured }
}

function setConfig(apiAuth?: Record<string, any>) {
  ;(globalThis as any).__escalated_config = apiAuth ? { apiAuth } : {}
}

describe('api auth controller', () => {
  afterEach(() => {
    delete (globalThis as any).__escalated_config
  })

  it('login returns 501 when no authenticator is configured', async () => {
    setConfig()
    const { ctx, captured } = fakeCtx({ email: 'a@b.com' })
    await new ApiAuthController().login(ctx)
    assert.equal(captured.status, 501)
  })

  it('login delegates to the authenticate callback', async () => {
    setConfig({ authenticate: (p: any) => ({ token: 'abc', email: p.email }) })
    const { ctx, captured } = fakeCtx({ email: 'a@b.com' })
    await new ApiAuthController().login(ctx)
    assert.equal(captured.status, 200)
    assert.deepEqual(captured.body, { data: { token: 'abc', email: 'a@b.com' } })
  })

  it('login returns 401 when the callback returns null', async () => {
    setConfig({ authenticate: () => null })
    const { ctx, captured } = fakeCtx({})
    await new ApiAuthController().login(ctx)
    assert.equal(captured.status, 401)
  })

  it('me forwards the bearer token to validate', async () => {
    let seen: string | undefined
    setConfig({
      validate: (token: string) => {
        seen = token
        return { id: 7 }
      },
    })
    const { ctx, captured } = fakeCtx({}, 'Bearer tok123')
    await new ApiAuthController().me(ctx)
    assert.equal(captured.status, 200)
    assert.equal(seen, 'tok123')
  })

  it('logout always succeeds', async () => {
    setConfig()
    const { ctx, captured } = fakeCtx({}, 'Bearer x')
    await new ApiAuthController().logout(ctx)
    assert.equal(captured.status, 200)
    assert.deepEqual(captured.body, { data: { success: true } })
  })
})
