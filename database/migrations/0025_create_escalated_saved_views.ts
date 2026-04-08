import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedSavedViews extends BaseSchema {
  protected tableName = 'escalated_saved_views'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('slug').notNullable()
      table.integer('user_id').unsigned().nullable().index()
      table.boolean('is_shared').defaultTo(false)
      table.boolean('is_default').defaultTo(false)
      table.json('filters').notNullable()
      table.json('columns').nullable()
      table.string('sort_by').nullable()
      table.string('sort_dir').defaultTo('desc')
      table.string('icon').nullable()
      table.string('color').nullable()
      table.integer('order').unsigned().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['slug', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
