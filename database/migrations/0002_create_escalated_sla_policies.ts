import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedSlaPolicies extends BaseSchema {
  protected tableName = 'escalated_sla_policies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.text('description').nullable()
      table.boolean('is_default').defaultTo(false)
      table.json('first_response_hours').notNullable()
      table.json('resolution_hours').notNullable()
      table.boolean('business_hours_only').defaultTo(false)
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
