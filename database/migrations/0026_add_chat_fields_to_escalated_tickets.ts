import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddChatFieldsToEscalatedTickets extends BaseSchema {
  protected tableName = 'escalated_tickets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('chat_ended_at', { useTz: true }).nullable()
      table.json('chat_metadata').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('chat_ended_at')
      table.dropColumn('chat_metadata')
    })
  }
}
