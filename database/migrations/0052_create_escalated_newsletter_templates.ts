import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedNewsletterTemplates extends BaseSchema {
  protected tableName = 'escalated_newsletter_templates'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('theme', 64).notNullable().defaultTo('default')
      table.string('subject_template', 998).nullable()
      table.text('body_markdown').notNullable()
      table.json('merge_fields_schema').nullable()
      table.integer('created_by').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index('theme')
      table.index('created_by')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
