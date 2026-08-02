import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

/**
 * System-wide audit trail. Complements the per-ticket
 * `escalated_ticket_activities` table by recording admin / config / security /
 * user actions that happen outside a single ticket.
 *
 * Mirrors the Laravel `create_escalated_audit_logs_table` migration:
 * actor (`user_id`), `action`, polymorphic target (`auditable_type` /
 * `auditable_id`), `old_values` / `new_values` JSON, request context
 * (`ip_address`, `user_agent`), and a `created_at` timestamp. The log is
 * append-only, so there is no `updated_at`.
 */
export default class CreateEscalatedAuditLogs extends BaseSchema {
  protected tableName = 'escalated_audit_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Actor — nullable so anonymous / system actions still record.
      userIdColumn(table, 'user_id').nullable()
      table.string('action').notNullable()
      // Polymorphic target. Nullable to allow pure system events with no row.
      // `auditable_id` is a string so int / uuid / string host keys round-trip.
      table.string('auditable_type').nullable()
      table.string('auditable_id', 255).nullable()
      table.json('old_values').nullable()
      table.json('new_values').nullable()
      table.string('ip_address').nullable()
      table.string('user_agent').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()

      table.index(['auditable_type', 'auditable_id'], 'audit_logs_auditable_idx')
      table.index(['user_id'], 'audit_logs_user_idx')
      table.index(['action'], 'audit_logs_action_idx')
      table.index(['created_at'], 'audit_logs_created_at_idx')
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
