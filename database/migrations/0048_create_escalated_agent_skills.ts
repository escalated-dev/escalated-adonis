import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

export default class CreateEscalatedAgentSkills extends BaseSchema {
  protected tableName = 'escalated_agent_skills'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      userIdColumn(table, 'user_id').notNullable()
      table
        .integer('skill_id')
        .unsigned()
        .references('id')
        .inTable('escalated_skills')
        .onDelete('CASCADE')
      table.smallInteger('proficiency').notNullable().defaultTo(3)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.unique(['user_id', 'skill_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
