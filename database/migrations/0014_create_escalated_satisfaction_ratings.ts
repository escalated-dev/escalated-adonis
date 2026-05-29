import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

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
      userIdColumn(table, 'rated_by_id').nullable()
      table.timestamp('created_at', { useTz: true }).nullable()

      table.index(['rated_by_type', 'rated_by_id'], 'satisfaction_ratings_rated_by_idx')
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
