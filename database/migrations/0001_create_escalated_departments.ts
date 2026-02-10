import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedDepartments extends BaseSchema {
  protected tableName = 'escalated_departments'
  protected pivotTableName = 'escalated_department_agent'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('slug').unique().notNullable()
      table.text('description').nullable()
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable(this.pivotTableName, (table) => {
      table
        .integer('department_id')
        .unsigned()
        .references('id')
        .inTable('escalated_departments')
        .onDelete('CASCADE')
      table.integer('agent_id').unsigned().notNullable()
      table.primary(['department_id', 'agent_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.pivotTableName)
    this.schema.dropTableIfExists(this.tableName)
  }
}
