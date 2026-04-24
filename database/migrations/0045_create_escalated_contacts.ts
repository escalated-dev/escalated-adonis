import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds a first-class Contact entity for guest requesters (Pattern B
 * convergence). Mirrors escalated-nestjs / escalated-laravel /
 * escalated-rails / escalated-django. Enables email-level dedupe
 * across tickets and a clean "promote to user" flow.
 *
 * Inline guest_name / guest_email / guest_token columns on tickets
 * remain for backwards compatibility; a follow-up backfill migration
 * populates contact_id for existing rows.
 */
export default class CreateEscalatedContacts extends BaseSchema {
  protected tableName = 'escalated_contacts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('email', 320).notNullable().unique()
      table.string('name').nullable()
      table
        .integer('user_id')
        .unsigned()
        .nullable()
        .comment('Linked host-app user id once the contact creates an account')
      table.json('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['user_id'])
    })

    this.schema.alterTable('escalated_tickets', (table) => {
      table
        .integer('contact_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('escalated_contacts')
        .onDelete('SET NULL')
      table.index(['contact_id'])
    })
  }

  async down() {
    this.schema.alterTable('escalated_tickets', (table) => {
      table.dropForeign(['contact_id'])
      table.dropIndex(['contact_id'])
      table.dropColumn('contact_id')
    })
    this.schema.dropTableIfExists(this.tableName)
  }
}
