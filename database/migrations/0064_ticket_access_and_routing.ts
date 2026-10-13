import { BaseSchema } from '@adonisjs/lucid/schema'

export default class TicketAccessAndRouting extends BaseSchema {
  async up() {
    this.schema.alterTable('escalated_tickets', (table) => {
      table.string('account_type', 191).nullable()
      table.string('account_id', 191).nullable()
      table.index(['account_type', 'account_id'], 'escalated_tickets_account_idx')
    })
    this.schema.alterTable('escalated_sla_policies', (table) => {
      table
        .integer('department_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('escalated_departments')
        .onDelete('RESTRICT')
      table.string('ticket_type', 32).nullable()
      table.index(['department_id', 'ticket_type'], 'escalated_sla_target_idx')
    })
  }

  async down() {
    this.schema.alterTable('escalated_sla_policies', (table) => {
      table.dropForeign(['department_id'])
      table.dropIndex(['department_id', 'ticket_type'], 'escalated_sla_target_idx')
      table.dropColumns('department_id', 'ticket_type')
    })
    this.schema.alterTable('escalated_tickets', (table) => {
      table.dropIndex(['account_type', 'account_id'], 'escalated_tickets_account_idx')
      table.dropColumns('account_type', 'account_id')
    })
  }
}
