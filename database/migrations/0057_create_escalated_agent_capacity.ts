import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

export default class CreateEscalatedAgentCapacity extends BaseSchema {
  protected tableName = 'escalated_agent_capacity'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      userIdColumn(table, 'user_id').notNullable()
      table.string('channel', 64).notNullable().defaultTo('default')
      table.integer('max_concurrent').unsigned().notNullable().defaultTo(10)
      table.integer('current_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).nullable()

      table.unique(['user_id', 'channel'], 'agent_capacity_user_channel_unique')
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
