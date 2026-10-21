import { BaseSchema } from '@adonisjs/lucid/schema'

/** The ticket a merged ticket was merged into (TicketMergeService). */
export default class TicketMergedInto extends BaseSchema {
  async up() {
    this.schema.alterTable('escalated_tickets', (table) => {
      table.integer('merged_into_id').unsigned().nullable()
      table.index(['merged_into_id'], 'escalated_tickets_merged_into_idx')
    })
  }

  async down() {
    this.schema.alterTable('escalated_tickets', (table) => {
      table.dropIndex(['merged_into_id'], 'escalated_tickets_merged_into_idx')
      table.dropColumn('merged_into_id')
    })
  }
}
