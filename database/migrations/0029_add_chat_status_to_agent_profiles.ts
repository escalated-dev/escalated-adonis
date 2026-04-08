import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddChatStatusToAgentProfiles extends BaseSchema {
  protected tableName = 'escalated_agent_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().notNullable().unique()
      table.string('chat_status').defaultTo('offline').notNullable()
      table.integer('max_concurrent_chats').unsigned().defaultTo(5)
      table.timestamp('last_seen_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
