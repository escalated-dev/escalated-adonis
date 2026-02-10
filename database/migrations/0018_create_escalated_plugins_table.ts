import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedPlugins extends BaseSchema {
  protected tableName = 'escalated_plugins'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('slug').unique().notNullable()
      table.boolean('is_active').defaultTo(false)
      table.timestamp('activated_at', { useTz: true }).nullable()
      table.timestamp('deactivated_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
