import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedAttachments extends BaseSchema {
  protected tableName = 'escalated_attachments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('attachable_type').notNullable()
      table.integer('attachable_id').unsigned().notNullable()
      table.string('filename').notNullable()
      table.string('original_filename').notNullable()
      table.string('mime_type').notNullable()
      table.bigInteger('size').unsigned().notNullable()
      table.string('disk').notNullable()
      table.string('path').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['attachable_type', 'attachable_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
