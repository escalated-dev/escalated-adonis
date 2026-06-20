import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddNextAttemptAtToNewsletterDeliveries extends BaseSchema {
  protected tableName = 'escalated_newsletter_deliveries'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('next_attempt_at', { useTz: true }).nullable()
      table.index(['status', 'next_attempt_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['status', 'next_attempt_at'])
      table.dropColumn('next_attempt_at')
    })
  }
}
