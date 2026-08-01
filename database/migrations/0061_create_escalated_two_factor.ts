import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

export default class CreateEscalatedTwoFactor extends BaseSchema {
  protected tableName = 'escalated_two_factor'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      userIdColumn(table, 'user_id').notNullable()
      // TOTP shared secret, encrypted at rest by the model.
      table.text('secret').notNullable()
      // JSON array of hashed single-use recovery codes.
      table.text('recovery_codes').nullable()
      table.timestamp('confirmed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['user_id'], 'two_factor_user_unique')
      table.index(['user_id'], 'two_factor_user_idx')
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
