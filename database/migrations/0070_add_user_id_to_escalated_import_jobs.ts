import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

/** The admin who started an import, as escalated-laravel records it. */
export default class AddUserIdToEscalatedImportJobs extends BaseSchema {
  protected tableName = 'escalated_import_jobs'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      userIdColumn(table as any, 'user_id').nullable()
      table.index(['user_id'], 'escalated_import_jobs_user_id_idx')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['user_id'], 'escalated_import_jobs_user_id_idx')
      table.dropColumn('user_id')
    })
  }
}
