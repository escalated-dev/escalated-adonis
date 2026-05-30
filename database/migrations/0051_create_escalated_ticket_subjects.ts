import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ticket subjects — host-app entities a ticket is *about* (Project, Customer,
 * asset, …), distinct from the requester and the subject *line* (free text).
 * `subject_id` is a string so integer, UUID, ULID, or other host keys work.
 */
export default class CreateEscalatedTicketSubjects extends BaseSchema {
  protected tableName = 'escalated_ticket_subjects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('ticket_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
      table.string('subject_type').notNullable()
      table.string('subject_id').notNullable()
      table.string('role').nullable()
      table.integer('position').unsigned().notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['ticket_id', 'subject_type', 'subject_id'])
      table.index(['subject_type', 'subject_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
