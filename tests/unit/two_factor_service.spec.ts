import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import TwoFactorService from '../../src/services/two_factor_service.ts'

/*
|--------------------------------------------------------------------------
| Two-Factor Service Unit Tests
|--------------------------------------------------------------------------
|
| Pure-logic tests for the RFC-6238 TOTP implementation and recovery-code
| handling in src/services/two_factor_service.ts. No database access.
|
| The known-answer TOTP vectors come from RFC 6238 Appendix B (SHA-1),
| whose shared secret is the ASCII string "12345678901234567890", i.e.
| the base32 secret "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ".
|
*/

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('TwoFactorService — secret generation', () => {
  const service = new TwoFactorService()

  it('generates a 16-character base32 secret', () => {
    const secret = service.generateSecret()
    assert.equal(secret.length, 16)
    assert.match(secret, /^[A-Z2-7]+$/)
  })

  it('generates unique secrets across calls', () => {
    assert.notEqual(service.generateSecret(), service.generateSecret())
  })

  it('builds an otpauth:// enrollment URI with the secret and issuer', () => {
    const uri = service.generateQrUri('ABCDEFGHIJKLMNOP', 'admin@example.com')
    assert.ok(uri.startsWith('otpauth://totp/'))
    assert.ok(uri.includes('secret=ABCDEFGHIJKLMNOP'))
    assert.ok(uri.includes('issuer='))
  })
})

describe('TwoFactorService — RFC 6238 TOTP vectors (SHA-1)', () => {
  const service = new TwoFactorService()

  // time (s) -> time-slice (floor(time / 30)) -> expected 6-digit code
  const vectors: Array<[number, number, string]> = [
    [59, 1, '287082'],
    [1111111109, 37037036, '081804'],
    [1234567890, 41152263, '005924'],
    [2000000000, 66666666, '279037'],
  ]

  for (const [time, slice, expected] of vectors) {
    it(`matches the vector at t=${time}`, () => {
      assert.equal(service.generateTotp(RFC_SECRET, slice), expected)
    })
  }
})

describe('TwoFactorService — verification', () => {
  const service = new TwoFactorService()

  it('accepts the code for the current time slice', () => {
    const secret = service.generateSecret()
    const slice = Math.floor(Date.now() / 1000 / 30)
    const code = service.generateTotp(secret, slice)
    assert.equal(service.verify(secret, code), true)
  })

  it('accepts a code one slice in the past (clock-drift window)', () => {
    const secret = service.generateSecret()
    const slice = Math.floor(Date.now() / 1000 / 30)
    assert.equal(service.verify(secret, service.generateTotp(secret, slice - 1)), true)
  })

  it('rejects a code from a far-away time slice', () => {
    const secret = service.generateSecret()
    const slice = Math.floor(Date.now() / 1000 / 30)
    assert.equal(service.verify(secret, service.generateTotp(secret, slice + 500)), false)
  })

  it('rejects a malformed / wrong code', () => {
    const secret = service.generateSecret()
    assert.equal(service.verify(secret, '000000'), false)
    assert.equal(service.verify(secret, 'abcdef'), false)
    assert.equal(service.verify(secret, ''), false)
  })
})

describe('TwoFactorService — recovery codes', () => {
  const service = new TwoFactorService()

  it('generates eight formatted recovery codes', () => {
    const codes = service.generateRecoveryCodes()
    assert.equal(codes.length, 8)
    for (const code of codes) {
      assert.match(code, /^[A-F0-9]{8}-[A-F0-9]{8}$/)
    }
  })

  it('verifies a recovery code and removes it (single use)', () => {
    const codes = service.generateRecoveryCodes()
    const hashed = codes.map((c) => service.hashRecoveryCode(c))

    const first = service.verifyRecoveryCode(hashed, codes[0])
    assert.equal(first.valid, true)
    assert.equal(first.remaining.length, 7)

    // The same code must not work a second time.
    const second = service.verifyRecoveryCode(first.remaining, codes[0])
    assert.equal(second.valid, false)
    assert.equal(second.remaining.length, 7)
  })

  it('rejects an unknown recovery code without consuming any', () => {
    const codes = service.generateRecoveryCodes()
    const hashed = codes.map((c) => service.hashRecoveryCode(c))
    const result = service.verifyRecoveryCode(hashed, 'DEADBEEF-DEADBEEF')
    assert.equal(result.valid, false)
    assert.equal(result.remaining.length, 8)
  })
})

describe('TwoFactorService — secret encryption at rest', () => {
  const service = new TwoFactorService()

  it('round-trips an encrypted secret', () => {
    const secret = service.generateSecret()
    const encrypted = service.encryptSecret(secret)
    assert.notEqual(encrypted, secret)
    assert.equal(service.decryptSecret(encrypted), secret)
  })

  it('returns null when decrypting garbage', () => {
    assert.equal(service.decryptSecret('not-a-valid-payload'), null)
  })
})
