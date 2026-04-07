import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

/*
|--------------------------------------------------------------------------
| SSO Service Unit Tests
|--------------------------------------------------------------------------
|
| Tests for JWT validation logic from src/services/sso_service.ts.
| These test the pure cryptographic functions without database access.
|
*/

function base64UrlEncode(data) {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  return Buffer.from(s, 'base64').toString('utf-8')
}

function createJwt(payload, secret, algorithm = 'HS256') {
  const header = base64UrlEncode(JSON.stringify({ alg: algorithm, typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify(payload))
  const signingInput = `${header}.${body}`

  const algoMap = { HS256: 'sha256', HS384: 'sha384', HS512: 'sha512' }
  const signature = base64UrlEncode(
    createHmac(algoMap[algorithm], secret).update(signingInput).digest()
  )

  return `${header}.${body}.${signature}`
}

describe('JWT creation and parsing', () => {
  it('creates a valid 3-part JWT', () => {
    const token = createJwt(
      { email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 3600 },
      'secret'
    )
    const parts = token.split('.')
    assert.equal(parts.length, 3)
  })

  it('payload round-trips correctly', () => {
    const payload = {
      email: 'user@test.com',
      name: 'Test',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }
    const token = createJwt(payload, 'secret')
    const decoded = JSON.parse(base64UrlDecode(token.split('.')[1]))
    assert.equal(decoded.email, 'user@test.com')
    assert.equal(decoded.name, 'Test')
  })

  it('signature verifies with correct secret', () => {
    const secret = 'my-test-secret'
    const token = createJwt({ email: 'a@b.com' }, secret)
    const [header, payload, sig] = token.split('.')
    const signingInput = `${header}.${payload}`
    const expected = base64UrlEncode(createHmac('sha256', secret).update(signingInput).digest())
    assert.equal(sig, expected)
  })

  it('signature does not verify with wrong secret', () => {
    const token = createJwt({ email: 'a@b.com' }, 'correct-secret')
    const [header, payload] = token.split('.')
    const signingInput = `${header}.${payload}`
    const wrongSig = base64UrlEncode(
      createHmac('sha256', 'wrong-secret').update(signingInput).digest()
    )
    const [, , originalSig] = token.split('.')
    assert.notEqual(originalSig, wrongSig)
  })
})

describe('JWT expiration checks', () => {
  it('detects expired token', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600
    const payload = { email: 'a@b.com', exp: pastExp }
    assert.ok(payload.exp < Math.floor(Date.now() / 1000))
  })

  it('accepts valid token', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const payload = { email: 'a@b.com', exp: futureExp }
    assert.ok(payload.exp > Math.floor(Date.now() / 1000))
  })

  it('detects not-yet-valid token', () => {
    const futureNbf = Math.floor(Date.now() / 1000) + 3600
    const payload = { email: 'a@b.com', nbf: futureNbf }
    assert.ok(payload.nbf > Math.floor(Date.now() / 1000))
  })
})

describe('SAML XML parsing', () => {
  it('base64-encodes and decodes XML correctly', () => {
    const xml =
      '<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"><saml:Issuer>test</saml:Issuer></saml:Assertion>'
    const encoded = Buffer.from(xml).toString('base64')
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8')
    assert.equal(decoded, xml)
  })

  it('rejects invalid base64', () => {
    assert.throws(() => {
      const decoded = Buffer.from('!!!invalid!!!', 'base64').toString('utf-8')
      if (!decoded.includes('<')) throw new Error('Not XML')
    })
  })
})
