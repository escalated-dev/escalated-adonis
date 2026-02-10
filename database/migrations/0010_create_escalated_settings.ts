import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedSettings extends BaseSchema {
  protected tableName = 'escalated_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('key').unique().notNullable()
      table.text('value').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    // Seed default settings
    this.defer(async (db) => {
      await db.table(this.tableName).multiInsert([
        { key: 'guest_tickets_enabled', value: '1', created_at: new Date(), updated_at: new Date() },
        { key: 'allow_customer_close', value: '1', created_at: new Date(), updated_at: new Date() },
        { key: 'auto_close_resolved_after_days', value: '7', created_at: new Date(), updated_at: new Date() },
        { key: 'max_attachments_per_reply', value: '5', created_at: new Date(), updated_at: new Date() },
        { key: 'max_attachment_size_kb', value: '10240', created_at: new Date(), updated_at: new Date() },
      ])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
