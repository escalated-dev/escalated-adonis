import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedSatisfactionRatings extends BaseSchema {
  protected tableName = 'escalated_satisfaction_ratings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('ticket_id')
        .unsigned()
        .unique()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
        .notNullable()
      table.tinyint('rating').notNullable()
      table.text('comment').nullable()
      table.string('rated_by_type').nullable()
      table.integer('rated_by_id').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).nullable()

      table.index(['rated_by_type', 'rated_by_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
