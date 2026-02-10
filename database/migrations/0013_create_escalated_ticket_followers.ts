import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedTicketFollowers extends BaseSchema {
  protected tableName = 'escalated_ticket_followers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table
        .integer('ticket_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable()
      table.timestamp('created_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['ticket_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
