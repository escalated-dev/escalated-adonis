import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

/**
 * The agent panel's data (ADR 2026-11-05-agent-panel-data):
 *
 * - `escalated_tickets.last_customer_activity_at` and `escalated_ticket_reads`,
 *   per-agent unread markers. Existing tickets get no activity, so none of
 *   them turn unread on upgrade.
 * - `escalated_customer_presence`: when each customer was last seen.
 * - `escalated_notifications`: the agents' in-app notifications.
 *
 * The agent's own status is the existing `escalated_agent_profiles.chat_status`.
 */
export default class CreateEscalatedAgentPanelData extends BaseSchema {
  async up() {
    this.schema.alterTable('escalated_tickets', (table) => {
      table.timestamp('last_customer_activity_at').nullable()
      table.index(['last_customer_activity_at'], 'escalated_tickets_customer_activity_idx')
    })

    this.schema.createTable('escalated_ticket_reads', (table) => {
      table.increments('id')
      userIdColumn(table, 'user_id').notNullable()
      table
        .integer('ticket_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
      table.timestamp('last_read_at').nullable()
      table.timestamp('created_at').nullable()
      table.timestamp('updated_at').nullable()
      table.unique(['user_id', 'ticket_id'], { indexName: 'escalated_ticket_reads_unique' })
      table.index(['ticket_id'], 'escalated_ticket_reads_ticket_idx')
    })

    this.schema.createTable('escalated_customer_presence', (table) => {
      table.increments('id')
      table.string('subject_type', 191).notNullable()
      // A string, so it holds integer, UUID and string keys alike.
      table.string('subject_id', 64).notNullable()
      table.timestamp('last_seen_at').notNullable()
      table.timestamp('created_at').nullable()
      table.timestamp('updated_at').nullable()
      table.unique(['subject_type', 'subject_id'], {
        indexName: 'escalated_customer_presence_unique',
      })
    })

    this.schema.createTable('escalated_notifications', (table) => {
      table.string('id', 36).primary()
      userIdColumn(table, 'user_id').notNullable()
      table.string('type', 64).notNullable()
      table.text('data').nullable()
      table.timestamp('read_at').nullable()
      table.timestamp('created_at').notNullable()
      table.index(['user_id', 'read_at'], 'escalated_notifications_user_idx')
    })
  }

  async down() {
    this.schema.dropTableIfExists('escalated_notifications')
    this.schema.dropTableIfExists('escalated_customer_presence')
    this.schema.dropTableIfExists('escalated_ticket_reads')
    this.schema.alterTable('escalated_tickets', (table) => {
      table.dropIndex(['last_customer_activity_at'], 'escalated_tickets_customer_activity_idx')
      table.dropColumn('last_customer_activity_at')
    })
  }
}
