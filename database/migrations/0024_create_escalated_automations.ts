import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedAutomations extends BaseSchema {
  protected tableName = 'escalated_automations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.json('conditions').notNullable()
      table.json('actions').notNullable()
      table.boolean('active').defaultTo(true)
      table.integer('position').defaultTo(0)
      table.timestamp('last_run_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
