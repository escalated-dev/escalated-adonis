import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

export default class CreateEscalatedSideConversations extends BaseSchema {
  async up() {
    this.schema.createTable('escalated_side_conversations', (table) => {
      table.increments('id')
      table
        .integer('ticket_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
        .notNullable()
      table.string('subject').notNullable()
      table.string('channel', 32).notNullable()
      table.string('status', 32).notNullable()
      userIdColumn(table, 'created_by').nullable()
      table.timestamp('created_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.index(['ticket_id'], 'side_conversations_ticket_idx')
    })

    this.schema.createTable('escalated_side_conversation_replies', (table) => {
      table.increments('id')
      table
        .integer('side_conversation_id')
        .unsigned()
        .references('id')
        .inTable('escalated_side_conversations')
        .onDelete('CASCADE')
        .notNullable()
      table.text('body').notNullable()
      userIdColumn(table, 'author_id').nullable()
      table.timestamp('created_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.index(['side_conversation_id'], 'side_conversation_replies_conversation_idx')
    })
  }

  async down() {
    this.schema.dropTableIfExists('escalated_side_conversation_replies')
    this.schema.dropTableIfExists('escalated_side_conversations')
  }
}
