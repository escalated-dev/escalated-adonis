import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedTicketActivities extends BaseSchema {
  protected tableName = 'escalated_ticket_activities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('ticket_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
        .notNullable()
      table.string('causer_type').nullable()
      table.integer('causer_id').unsigned().nullable()
      table.string('type').notNullable()
      table.json('properties').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['causer_type', 'causer_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
