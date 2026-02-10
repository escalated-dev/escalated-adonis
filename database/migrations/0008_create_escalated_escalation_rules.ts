import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedEscalationRules extends BaseSchema {
  protected tableName = 'escalated_escalation_rules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.string('trigger_type').notNullable()
      table.json('conditions').notNullable()
      table.json('actions').notNullable()
      table.integer('order').unsigned().defaultTo(0)
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
