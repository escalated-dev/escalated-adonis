import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedChatRoutingRules extends BaseSchema {
  protected tableName = 'escalated_chat_routing_rules'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.integer('priority').unsigned().defaultTo(0).index()
      table.boolean('is_active').defaultTo(true)
      table.json('conditions').nullable()
      table.json('actions').nullable()
      table.integer('max_chats_per_agent').unsigned().defaultTo(5)
      table.integer('department_id').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
