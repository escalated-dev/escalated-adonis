import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedChatSessions extends BaseSchema {
  protected tableName = 'escalated_chat_sessions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('ticket_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
      table.integer('agent_id').unsigned().nullable().index()
      table.integer('visitor_id').unsigned().nullable()
      table.string('visitor_name').nullable()
      table.string('visitor_email').nullable()
      table.string('visitor_token', 64).nullable().unique()
      table.string('status').defaultTo('waiting').notNullable().index()
      table.integer('department_id').unsigned().nullable()
      table.integer('rating').nullable()
      table.text('rating_comment').nullable()
      table.integer('messages_count').unsigned().defaultTo(0)
      table.json('metadata').nullable()
      table.timestamp('accepted_at', { useTz: true }).nullable()
      table.timestamp('ended_at', { useTz: true }).nullable()
      table.timestamp('last_activity_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
