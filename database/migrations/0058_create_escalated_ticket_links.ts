import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedTicketLinks extends BaseSchema {
  protected tableName = 'escalated_ticket_links'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('parent_ticket_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
        .notNullable()
      table
        .integer('child_ticket_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
        .notNullable()
      table.string('link_type', 32).notNullable()
      table.timestamp('created_at', { useTz: true }).nullable()

      table.index(['parent_ticket_id'], 'ticket_links_parent_idx')
      table.index(['child_ticket_id'], 'ticket_links_child_idx')
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
