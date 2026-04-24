import { type DateTime } from 'luxon'
import { BaseModel, column, hasMany, beforeSave } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Ticket from './ticket.js'

/**
 * First-class identity for guest requesters. Deduped by email
 * (unique index, case-insensitively normalized on save). Links to a
 * host-app user via `userId` once the guest accepts a signup invite.
 *
 * Coexists with the inline guest_* columns on Ticket for one
 * release — the backfill migration populates `contact_id` for
 * existing rows. New code should write via Contact.findOrCreateByEmail.
 */
export default class Contact extends BaseModel {
  static table = 'escalated_contacts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column()
  declare name: string | null

  @column({ columnName: 'user_id' })
  declare userId: number | null

  @column({
    prepare: (value: unknown) => JSON.stringify(value ?? {}),
    consume: (value: unknown) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return {}
        }
      }
      return value ?? {}
    },
  })
  declare metadata: Record<string, unknown>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Ticket, { foreignKey: 'contactId' })
  declare tickets: HasMany<typeof Ticket>

  @beforeSave()
  static async normalizeEmail(contact: Contact) {
    if (contact.email) {
      contact.email = contact.email.trim().toLowerCase()
    }
  }

  static async findOrCreateByEmail(email: string, name?: string | null): Promise<Contact> {
    const normalized = (email ?? '').trim().toLowerCase()
    const existing = await this.query().where('email', normalized).first()
    if (existing) {
      if (!existing.name && name) {
        existing.name = name
        await existing.save()
      }
      return existing
    }
    return this.create({ email: normalized, name: name ?? null, userId: null, metadata: {} })
  }

  async linkToUser(userId: number): Promise<this> {
    this.userId = userId
    await this.save()
    return this
  }

  /**
   * Link + back-stamp requester_id / requester_type on all prior tickets
   * owned by this contact. userType matches host-app polymorphic target
   * convention.
   */
  async promoteToUser(userId: number, userType: string = 'User'): Promise<this> {
    await this.linkToUser(userId)
    await Ticket.query().where('contactId', this.id).update({
      requesterId: userId,
      requesterType: userType,
    })
    return this
  }
}
