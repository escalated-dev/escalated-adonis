import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * One system row per built-in status: [slug, label, colour, category]. Kept
 * here rather than imported, because `configure` copies migrations into the
 * host app, where the package's sources are not a relative import away.
 * Matches STATUS_LABELS, STATUS_COLORS and BUILT_IN_CATEGORIES.
 */
const BUILT_INS: Array<[string, string, string, string]> = [
  ['open', 'Open', '#3B82F6', 'open'],
  ['in_progress', 'In Progress', '#8B5CF6', 'open'],
  ['waiting_on_customer', 'Waiting on Customer', '#F59E0B', 'pending'],
  ['waiting_on_agent', 'Waiting on Agent', '#F97316', 'open'],
  ['escalated', 'Escalated', '#EF4444', 'open'],
  ['resolved', 'Resolved', '#10B981', 'solved'],
  ['closed', 'Closed', '#6B7280', 'solved'],
  ['reopened', 'Reopened', '#3B82F6', 'open'],
]

/**
 * Custom ticket statuses (src/support/custom_statuses.ts).
 *
 * Existing tickets keep their built-in `status` and get a NULL
 * `ticket_status_id`; nothing is backfilled. The built-ins are seeded as
 * system rows so the admin page lists them; lifecycle code never reads them.
 */
export default class CreateEscalatedTicketStatuses extends BaseSchema {
  async up() {
    this.schema.createTable('escalated_ticket_statuses', (table) => {
      table.increments('id')
      table.string('label', 255).notNullable()
      table.string('slug', 191).notNullable().unique('escalated_ticket_statuses_slug_unique')
      table.string('category', 32).notNullable()
      table.string('color', 20).notNullable().defaultTo('#6b7280')
      table.text('description').nullable()
      table.integer('position').notNullable().defaultTo(0)
      table.boolean('is_default').notNullable().defaultTo(false)
      table.boolean('is_system').notNullable().defaultTo(false)
      table.timestamp('created_at').nullable()
      table.timestamp('updated_at').nullable()
      table.index(['category', 'position'], 'escalated_ticket_statuses_category_idx')
    })

    this.schema.alterTable('escalated_tickets', (table) => {
      table
        .integer('ticket_status_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('escalated_ticket_statuses')
        .onDelete('SET NULL')
      table.index(['ticket_status_id'], 'escalated_tickets_ticket_status_idx')
    })

    this.defer(async (db) => {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      const positions: Record<string, number> = {}
      await db.table('escalated_ticket_statuses').multiInsert(
        BUILT_INS.map(([slug, label, color, category]) => {
          const position = positions[category] ?? 0
          positions[category] = position + 1
          return {
            label,
            slug,
            category,
            color,
            description: null,
            position,
            is_default: false,
            is_system: true,
            created_at: now,
            updated_at: now,
          }
        })
      )
    })
  }

  async down() {
    this.schema.alterTable('escalated_tickets', (table) => {
      table.dropForeign(['ticket_status_id'])
      table.dropIndex(['ticket_status_id'], 'escalated_tickets_ticket_status_idx')
      table.dropColumn('ticket_status_id')
    })
    this.schema.dropTable('escalated_ticket_statuses')
  }
}
