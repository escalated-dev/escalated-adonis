import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedImportJobs extends BaseSchema {
  protected tableName = 'escalated_import_jobs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      // UUID primary key — generated app-side via `crypto.randomUUID()`
      // in ImportJob's `beforeCreate` hook. App-level generation keeps
      // the migration portable across sqlite, postgres, and mysql; each
      // dialect needs a different DB-side default (`gen_random_uuid()`,
      // `(UUID())`, sqlite has nothing native), so we don't pick one.
      table.uuid('id').primary()

      // Platform slug (e.g. "zendesk", "freshdesk", "intercom")
      table.string('platform').notNullable()

      // Import lifecycle status
      table
        .enum('status', [
          'pending',
          'authenticating',
          'mapping',
          'importing',
          'paused',
          'completed',
          'failed',
        ])
        .notNullable()
        .defaultTo('pending')

      // Encrypted credentials JSON (AES-256-GCM, base64-encoded)
      table.text('credentials').nullable()

      // User-defined field mappings per entity type (JSON)
      table.text('field_mappings').nullable()

      // Per-entity-type progress counters and cursors (JSON)
      table.text('progress').nullable()

      // Error log (JSON array, capped at 10,000 entries)
      table.text('error_log').nullable()

      table.timestamp('started_at', { useTz: true }).nullable()
      table.timestamp('completed_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
