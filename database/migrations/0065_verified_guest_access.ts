import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Verified guest access (docs/guest-access.md): one-time email codes, and the
 * columns that hold a ticket's verified guest email and its expiring grant.
 * Neither the code nor the email address is stored in the clear.
 */
export default class VerifiedGuestAccess extends BaseSchema {
  async up() {
    this.schema.createTable('escalated_guest_verifications', (table) => {
      table.string('id', 36).primary()
      table.string('email_digest', 191).notNullable()
      table.string('purpose', 16).notNullable()
      table.string('code_hash', 191).notNullable()
      table.integer('attempts').notNullable().defaultTo(0)
      table.timestamp('expires_at').notNullable()
      table.timestamp('used_at').nullable()
      table.timestamp('created_at').nullable()
      table.timestamp('updated_at').nullable()
      table.index(['expires_at'], 'escalated_guest_verifications_expires_idx')
    })

    this.schema.alterTable('escalated_tickets', (table) => {
      table.string('guest_access_hash', 64).nullable()
      table.timestamp('guest_access_expires_at').nullable()
      table.string('guest_verified_email', 191).nullable()
      table.timestamp('guest_email_verified_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable('escalated_tickets', (table) => {
      table.dropColumns(
        'guest_access_hash',
        'guest_access_expires_at',
        'guest_verified_email',
        'guest_email_verified_at'
      )
    })
    this.schema.dropTable('escalated_guest_verifications')
  }
}
