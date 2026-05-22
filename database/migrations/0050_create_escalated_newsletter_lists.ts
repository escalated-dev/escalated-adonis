import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedNewsletterLists extends BaseSchema {
  protected tableName = 'escalated_newsletter_lists'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.string('kind', 16).notNullable()
      table.json('filter_json').nullable()
      table.integer('created_by').unsigned().nullable()
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
