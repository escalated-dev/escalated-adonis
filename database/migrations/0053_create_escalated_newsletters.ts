import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

export default class CreateEscalatedNewsletters extends BaseSchema {
  protected tableName = 'escalated_newsletters'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('subject', 998).notNullable()
      table.string('from_email', 320).notNullable()
      table.string('from_name').nullable()
      table.string('reply_to', 320).nullable()
      table.integer('target_list_id').unsigned().notNullable()
      table.integer('template_id').unsigned().nullable()
      table.string('theme', 64).nullable()
      table.text('body_markdown').nullable()
      table.string('status', 16).notNullable().defaultTo('draft')
      table.timestamp('scheduled_at', { useTz: true }).nullable()
      table.timestamp('sent_at', { useTz: true }).nullable()
      userIdColumn(table, 'created_by').nullable()
      userIdColumn(table, 'sent_by').nullable()
      table.integer('summary_total').notNullable().defaultTo(0)
      table.integer('summary_sent').notNullable().defaultTo(0)
      table.integer('summary_opened').notNullable().defaultTo(0)
      table.integer('summary_clicked').notNullable().defaultTo(0)
      table.integer('summary_bounced').notNullable().defaultTo(0)
      table.integer('summary_complained').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index('status')
      table.index('scheduled_at')
      table.index(['status', 'scheduled_at'])
      table.index('created_by')
      table
        .foreign('target_list_id')
        .references('escalated_newsletter_lists.id')
        .onDelete('RESTRICT')
      table
        .foreign('template_id')
        .references('escalated_newsletter_templates.id')
        .onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
