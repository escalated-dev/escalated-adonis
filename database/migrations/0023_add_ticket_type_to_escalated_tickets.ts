import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddTicketTypeToEscalatedTickets extends BaseSchema {
  protected tableName = 'escalated_tickets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('ticket_type').defaultTo('question').notNullable().index().after('priority')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('ticket_type')
    })
  }
}
