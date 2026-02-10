import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedCannedResponses extends BaseSchema {
  protected tableName = 'escalated_canned_responses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('title').notNullable()
      table.text('body').notNullable()
      table.string('category').nullable()
      table.integer('created_by').unsigned().nullable()
      table.boolean('is_shared').defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
