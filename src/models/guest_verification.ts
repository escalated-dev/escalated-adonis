import { type DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'

/**
 * A one-time email code (docs/guest-access.md). The address and the code are
 * stored only as keyed digests.
 */
export default class GuestVerification extends EscalatedBaseModel {
  static table = 'escalated_guest_verifications'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare emailDigest: string

  @column()
  declare purpose: string

  @column({ serializeAs: null })
  declare codeHash: string

  @column()
  declare attempts: number

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime()
  declare usedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
