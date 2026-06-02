import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedNewsletterListMembers extends BaseSchema {
  protected tableName = 'escalated_newsletter_list_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('list_id').unsigned().notNullable()
      table.integer('contact_id').unsigned().notNullable()
      table.timestamp('added_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.integer('added_by').unsigned().nullable()

      table.unique(['list_id', 'contact_id'])
      table.index('contact_id')
      table.foreign('list_id').references('escalated_newsletter_lists.id').onDelete('CASCADE')
      table.foreign('contact_id').references('escalated_contacts.id').onDelete('CASCADE')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
