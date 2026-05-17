import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedSkillRoutingTags extends BaseSchema {
  protected tableName = 'escalated_skill_routing_tags'

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
        .integer('tag_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tags')
        .onDelete('CASCADE')
      table.unique(['skill_id', 'tag_id'])
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
