import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedApiTokens extends BaseSchema {
  protected tableName = 'escalated_api_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('tokenable_type').notNullable()
      table.integer('tokenable_id').unsigned().notNullable()
      table.string('name').notNullable()
      table.string('token', 64).unique().notNullable()
      table.json('abilities').nullable()
      table.timestamp('last_used_at', { useTz: true }).nullable()
      table.string('last_used_ip', 45).nullable()
      table.timestamp('expires_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['tokenable_type', 'tokenable_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
