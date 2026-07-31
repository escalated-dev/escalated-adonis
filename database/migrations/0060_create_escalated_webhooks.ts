import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedWebhooks extends BaseSchema {
  protected tableName = 'escalated_webhooks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('url').notNullable()
      table.json('events').notNullable()
      table.string('secret').nullable()
      table.boolean('active').defaultTo(true).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('escalated_webhook_deliveries', (table) => {
      table.increments('id')
      table
        .integer('webhook_id')
        .unsigned()
        .references('id')
        .inTable('escalated_webhooks')
        .onDelete('CASCADE')
        .notNullable()
      table.string('event').notNullable()
      table.json('payload').nullable()
      table.smallint('response_code').nullable()
      table.text('response_body').nullable()
      table.smallint('attempts').defaultTo(0).notNullable()
      table.timestamp('delivered_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['webhook_id'], 'webhook_deliveries_webhook_idx')
      table.index(['event'], 'webhook_deliveries_event_idx')
    })
  }

  async down() {
    this.schema.dropTableIfExists('escalated_webhook_deliveries')
    this.schema.dropTableIfExists(this.tableName)
  }
}
