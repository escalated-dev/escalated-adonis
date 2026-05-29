import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

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
      userIdColumn(table, 'causer_id').nullable()
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
