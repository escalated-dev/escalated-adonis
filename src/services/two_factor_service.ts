import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from 'node:crypto'
import { HOTP, Secret, TOTP } from 'otpauth'

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
 * TOTP is RFC 6238 (HMAC-SHA1, 6 digits, 30 s steps) through the maintained
 * `otpauth` library, accepting one step of clock drift either side. Also
 * handles single-use recovery codes (stored as SHA-256 hashes) and at-rest
 * encryption of the shared secret.
 */
export default class TwoFactorService {
  /** TOTP time step, in seconds. */
  static readonly PERIOD = 30

  /** Number of digits in a code. */
  static readonly DIGITS = 6

  /** Steps of clock drift accepted either side of now. */
  static readonly WINDOW = 1

  /**
   * A random base32 secret: 20 bytes (160 bits, the RFC 4226 recommendation)
   * by default, which is 32 base32 characters.
   */
  generateSecret(bytes = 20): string {
    return new Secret({ size: bytes }).base32
  }

  /**
   * The otpauth:// URI an authenticator app reads from a QR code.
   */
  generateQrUri(secret: string, email: string, issuer?: string): string {
    const appName = issuer ?? process.env.APP_NAME ?? 'Escalated'
    return this.totp(secret, { issuer: appName, label: email }).toString()
  }

  /**
   * The code for a specific counter (time step).
   */
  generateTotp(secret: string, timeSlice: number): string {
    return HOTP.generate({
      secret: Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: TwoFactorService.DIGITS,
      counter: timeSlice,
    })
  }

  /**
   * The code for a given Unix timestamp in seconds (default now).
   */
  codeForTimestamp(secret: string, timestamp: number = Date.now() / 1000): string {
    return this.totp(secret).generate({ timestamp: timestamp * 1000 })
  }

  /** The time step a Unix timestamp in milliseconds falls in (default now). */
  currentStep(timestamp: number = Date.now()): number {
    return TOTP.counter({ period: TwoFactorService.PERIOD, timestamp })
  }

  /**
   * Whether the code is valid for the secret now, within +/- `window` steps.
   * No replay check: see `matchStep()`.
   */
  verify(secret: string, code: string, window = TwoFactorService.WINDOW): boolean {
    return this.matchStep(secret, code, null, window) !== null
  }

  /**
   * The time step the code belongs to, within +/- `window` steps of now and
   * later than `lastUsedStep`, or null. A step at or before the last one
   * accepted is never matched, so a code works once.
   */
  matchStep(
    secret: string,
    code: string,
    lastUsedStep: number | null,
    window = TwoFactorService.WINDOW
  ): number | null {
    const token = this.normalizeCode(code)
    if (!/^\d{6}$/.test(token)) return null

    let key: Secret
    try {
      key = Secret.fromBase32(secret)
    } catch {
      return null
    }

    const now = this.currentStep()
    for (let step = now - window; step <= now + window; step++) {
      if (lastUsedStep !== null && step <= lastUsedStep) continue
      const delta = HOTP.validate({
        token,
        secret: key,
        algorithm: 'SHA1',
        digits: TwoFactorService.DIGITS,
        counter: step,
        window: 0,
      })
      if (delta === 0) return step
    }
    return null
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
   * in plaintext) and shown to the user only once, at enrolment.
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
    if (submitted.trim() === '') {
      return { valid: false, remaining: hashedCodes }
    }
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

  private totp(secret: string, extra: { issuer?: string; label?: string } = {}): TOTP {
    return new TOTP({
      ...extra,
      secret: Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: TwoFactorService.DIGITS,
      period: TwoFactorService.PERIOD,
    })
  }

  /** Authenticator apps show codes in groups ("123 456"); spaces are not part of it. */
  private normalizeCode(code: string): string {
    return String(code ?? '').replace(/\s+/g, '')
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
