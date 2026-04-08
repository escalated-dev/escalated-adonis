import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddSnoozeFieldsToEscalatedTickets extends BaseSchema {
  protected tableName = 'escalated_tickets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('snoozed_until', { useTz: true }).nullable()
      table.integer('snoozed_by').unsigned().nullable()
      table.string('status_before_snooze').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('snoozed_until')
      table.dropColumn('snoozed_by')
      table.dropColumn('status_before_snooze')
    })
  }
}
