import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedNewsletterDeliveries extends BaseSchema {
  protected tableName = 'escalated_newsletter_deliveries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.integer('newsletter_id').unsigned().notNullable()
      table.integer('contact_id').unsigned().notNullable()
      table.string('email_at_send', 320).notNullable()
      table.string('status', 16).notNullable().defaultTo('pending')
      table.string('tracking_token', 40).notNullable().unique()
      table.timestamp('sent_at', { useTz: true }).nullable()
      table.timestamp('opened_at', { useTz: true }).nullable()
      table.timestamp('last_clicked_at', { useTz: true }).nullable()
      table.integer('clicks_count').notNullable().defaultTo(0)
      table.text('bounce_reason').nullable()
      table.text('failure_reason').nullable()
      table.smallint('attempt_count').notNullable().defaultTo(0)
      table.timestamp('claimed_at', { useTz: true }).nullable()
      table.boolean('is_test').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['newsletter_id', 'status'])
      table.index('contact_id')
      table.index(['status', 'claimed_at'])
      table.foreign('newsletter_id').references('escalated_newsletters.id').onDelete('CASCADE')
      table.foreign('contact_id').references('escalated_contacts.id').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
