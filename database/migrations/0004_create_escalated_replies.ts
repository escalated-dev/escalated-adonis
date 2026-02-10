import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedReplies extends BaseSchema {
  protected tableName = 'escalated_replies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('ticket_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
        .notNullable()
      table.string('author_type').nullable()
      table.integer('author_id').unsigned().nullable()
      table.text('body').notNullable()
      table.boolean('is_internal_note').defaultTo(false)
      table.boolean('is_pinned').defaultTo(false)
      table.string('type').defaultTo('reply').notNullable()
      table.json('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.index(['author_type', 'author_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
