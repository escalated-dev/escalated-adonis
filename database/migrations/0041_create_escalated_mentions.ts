import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

export default class extends BaseSchema {
  protected tableName = 'escalated_mentions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('reply_id')
        .unsigned()
        .references('id')
        .inTable('escalated_replies')
        .onDelete('CASCADE')
      userIdColumn(table, 'user_id').notNullable()
      table.timestamp('read_at').nullable()
      table.timestamp('created_at')
      table.unique(['reply_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
