import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddMarketingOptOutAtToEscalatedContacts extends BaseSchema {
  protected tableName = 'escalated_contacts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('marketing_opt_out_at', { useTz: true }).nullable()
      table.index('marketing_opt_out_at')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex('marketing_opt_out_at')
      table.dropColumn('marketing_opt_out_at')
    })
  }
}
