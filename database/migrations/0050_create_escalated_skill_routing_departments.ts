import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedSkillRoutingDepartments extends BaseSchema {
  protected tableName = 'escalated_skill_routing_departments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('skill_id')
        .unsigned()
        .references('id')
        .inTable('escalated_skills')
        .onDelete('CASCADE')
      table
        .integer('department_id')
        .unsigned()
        .references('id')
        .inTable('escalated_departments')
        .onDelete('CASCADE')
      table.unique(['skill_id', 'department_id'])
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
