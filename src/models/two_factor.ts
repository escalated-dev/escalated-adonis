import { type DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { UserId } from '../helpers/user_id_column.js'
import TwoFactorService from '../services/two_factor_service.js'

const service = new TwoFactorService()

/**
 * A user's two-factor authentication enrollment.
 *
 * Mirrors the Laravel/Symfony reference: one row per user holding the TOTP
 * shared secret (encrypted at rest), the single-use recovery codes (stored as
 * SHA-256 hashes), and a `confirmedAt` marker set once the user verifies their
 * first code. A pending (unconfirmed) row means setup was started but not
 * completed.
 */
export default class TwoFactor extends BaseModel {
  static table = 'escalated_two_factor'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: UserId

  /**
   * The base32 TOTP secret. Encrypted with AES-256-GCM on the way into the
   * database and transparently decrypted on the way out.
   */
  @column({
    prepare: (value: string | null) => (value ? service.encryptSecret(value) : value),
    consume: (value: string | null) => (value ? service.decryptSecret(value) : value),
  })
  declare secret: string

  /**
   * Hashed single-use recovery codes. Persisted as a JSON array of SHA-256
   * hashes; the plaintext codes are shown to the user only once, at generation.
   */
  @column({
    prepare: (value: string[] | null) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare recoveryCodes: string[] | null

  @column.dateTime()
  declare confirmedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Methods ----

  /**
   * Whether two-factor is fully set up (the user confirmed a first code).
   */
  isConfirmed(): boolean {
    return this.confirmedAt !== null
  }
}
