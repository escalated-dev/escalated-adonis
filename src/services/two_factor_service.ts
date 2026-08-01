import {
  randomBytes,
  createHmac,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from 'node:crypto'

/**
 * Result of attempting to consume a recovery code.
 *
 * `remaining` is the (possibly shortened) list of hashed codes that should be
 * persisted back to the store — with the used code removed when `valid` is true.
 */
export interface RecoveryCodeResult {
  valid: boolean
  remaining: string[]
}

/**
 * Two-factor authentication service.
 *
 * Implements RFC-6238 TOTP (HMAC-SHA1, 6 digits, 30s period) using Node's
 * built-in `crypto` module — no third-party OTP dependency — mirroring the
 * Laravel/Symfony reference ports. Also handles single-use recovery codes and
 * at-rest encryption of the shared secret.
 */
export default class TwoFactorService {
  /** Base32 (RFC 4648) alphabet used for secrets. */
  private readonly base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

  /** TOTP time step, in seconds. */
  private readonly period = 30

  /** Number of digits in a generated code. */
  private readonly digits = 6

  /**
   * Generate a random base32 secret (16 chars by default).
   */
  generateSecret(length = 16): string {
    const bytes = randomBytes(length)
    let secret = ''
    for (let i = 0; i < length; i++) {
      secret += this.base32Chars[bytes[i] % 32]
    }
    return secret
  }

  /**
   * Build an otpauth:// URI for QR-code enrollment in an authenticator app.
   */
  generateQrUri(secret: string, email: string, issuer?: string): string {
    const appName = issuer ?? process.env.APP_NAME ?? 'Escalated'
    const label = encodeURIComponent(`${appName}:${email}`)
    const params = new URLSearchParams({
      secret,
      issuer: appName,
      algorithm: 'SHA1',
      digits: String(this.digits),
      period: String(this.period),
    })
    return `otpauth://totp/${label}?${params.toString()}`
  }

  /**
   * Generate the TOTP code for a specific counter (time-slice) value.
   *
   * The `secret` is the base32-encoded shared secret. This is the low-level
   * RFC-6238 primitive; `verify()` calls it across a small window.
   */
  generateTotp(secret: string, timeSlice: number): string {
    const key = this.base32Decode(secret)

    // Pack the counter as a 64-bit big-endian integer.
    const counter = Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(timeSlice))

    const hmac = createHmac('sha1', key).update(counter).digest()

    // Dynamic truncation (RFC 4226 §5.3).
    const offset = hmac[hmac.length - 1] & 0x0f
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)

    const code = binary % 10 ** this.digits
    return code.toString().padStart(this.digits, '0')
  }

  /**
   * Generate the TOTP code for a given unix timestamp (defaults to now).
   */
  codeForTimestamp(secret: string, timestamp: number = Date.now() / 1000): string {
    return this.generateTotp(secret, Math.floor(timestamp / this.period))
  }

  /**
   * Verify a TOTP code against a secret, tolerating +/- `window` time-slices
   * of clock drift (default +/- 1 slice = +/- 30s).
   */
  verify(secret: string, code: string, window = 1): boolean {
    if (!/^\d{6}$/.test(code)) {
      return false
    }

    const currentSlice = Math.floor(Date.now() / 1000 / this.period)
    for (let i = -window; i <= window; i++) {
      if (this.timingSafeEqualString(this.generateTotp(secret, currentSlice + i), code)) {
        return true
      }
    }
    return false
  }

  /**
   * Generate an array of formatted single-use recovery codes.
   */
  generateRecoveryCodes(count = 8): string[] {
    const codes: string[] = []
    for (let i = 0; i < count; i++) {
      const left = randomBytes(4).toString('hex').toUpperCase()
      const right = randomBytes(4).toString('hex').toUpperCase()
      codes.push(`${left}-${right}`)
    }
    return codes
  }

  /**
   * Hash a recovery code for storage. Recovery codes are stored hashed (never
   * in plaintext) and shown to the user only once, at generation time.
   */
  hashRecoveryCode(code: string): string {
    return createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
  }

  /**
   * Verify a submitted recovery code against a list of stored hashes.
   *
   * On success, returns `valid: true` and `remaining` with the matched hash
   * removed (recovery codes are single-use). On failure, `remaining` is the
   * original list, unchanged.
   */
  verifyRecoveryCode(hashedCodes: string[], submitted: string): RecoveryCodeResult {
    const target = this.hashRecoveryCode(submitted)
    const index = hashedCodes.findIndex((hash) => this.timingSafeEqualString(hash, target))

    if (index === -1) {
      return { valid: false, remaining: hashedCodes }
    }

    const remaining = hashedCodes.filter((_, i) => i !== index)
    return { valid: true, remaining }
  }

  /**
   * Encrypt a secret for storage at rest (AES-256-GCM). The key is derived from
   * the host app key so secrets are unreadable without it.
   */
  encryptSecret(plain: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
  }

  /**
   * Decrypt a secret produced by `encryptSecret`. Returns `null` if the payload
   * is malformed or authentication fails (e.g. wrong key / tampering).
   */
  decryptSecret(payload: string): string | null {
    try {
      const [ivB64, tagB64, dataB64] = payload.split(':')
      if (!ivB64 || !tagB64 || !dataB64) {
        return null
      }
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey(),
        Buffer.from(ivB64, 'base64')
      )
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
      ])
      return decrypted.toString('utf8')
    } catch {
      return null
    }
  }

  /**
   * Derive a 32-byte AES key from the host app key.
   */
  private encryptionKey(): Buffer {
    const appKey =
      process.env.APP_KEY ?? process.env.ESCALATED_APP_KEY ?? 'escalated-two-factor-fallback-key'
    return createHash('sha256').update(String(appKey)).digest()
  }

  /**
   * Decode a base32 (RFC 4648) string to its raw bytes.
   */
  private base32Decode(input: string): Buffer {
    const map: Record<string, number> = {}
    for (let i = 0; i < this.base32Chars.length; i++) {
      map[this.base32Chars[i]] = i
    }

    const clean = input.toUpperCase().replace(/=+$/, '')
    let bits = ''
    for (const char of clean) {
      if (!(char in map)) {
        continue
      }
      bits += map[char].toString(2).padStart(5, '0')
    }

    const bytes: number[] = []
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
    }
    return Buffer.from(bytes)
  }

  /**
   * Constant-time string comparison that never throws on length mismatch.
   */
  private timingSafeEqualString(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      return false
    }
    return timingSafeEqual(bufA, bufB)
  }
}
