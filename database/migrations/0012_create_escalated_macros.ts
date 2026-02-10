import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedMacros extends BaseSchema {
  protected tableName = 'escalated_macros'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('description').nullable()
      table.json('actions').notNullable()
      table.integer('created_by').unsigned().nullable()
      table.boolean('is_shared').defaultTo(true)
      table.integer('order').defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
