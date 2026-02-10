import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedTags extends BaseSchema {
  protected tableName = 'escalated_tags'
  protected pivotTableName = 'escalated_ticket_tag'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('slug').unique().notNullable()
      table.string('color').defaultTo('#6B7280')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable(this.pivotTableName, (table) => {
      table
        .integer('ticket_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
      table
        .integer('tag_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tags')
        .onDelete('CASCADE')
      table.primary(['ticket_id', 'tag_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.pivotTableName)
    this.schema.dropTableIfExists(this.tableName)
  }
}
