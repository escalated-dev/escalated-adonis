import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

export default class CreateEscalatedNewsletterLists extends BaseSchema {
  protected tableName = 'escalated_newsletter_lists'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.string('kind', 16).notNullable()
      table.json('filter_json').nullable()
      userIdColumn(table, 'created_by').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index('kind')
      table.index('created_by')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
