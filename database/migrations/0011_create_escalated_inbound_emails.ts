import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedInboundEmails extends BaseSchema {
  protected tableName = 'escalated_inbound_emails'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('message_id').nullable().unique()
      table.string('from_email').notNullable()
      table.string('from_name').nullable()
      table.string('to_email').notNullable()
      table.string('subject').notNullable()
      table.text('body_text').nullable()
      table.text('body_html').nullable()
      table.text('raw_headers').nullable()
      table
        .integer('ticket_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('SET NULL')
      table
        .integer('reply_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('escalated_replies')
        .onDelete('SET NULL')
      table.string('status').defaultTo('pending').notNullable()
      table.string('adapter').notNullable()
      table.text('error_message').nullable()
      table.timestamp('processed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['from_email'])
      table.index(['status'])
      table.index(['adapter'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
