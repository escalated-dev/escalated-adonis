import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedImportSourceMaps extends BaseSchema {
  protected tableName = 'escalated_import_source_maps'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .uuid('import_job_id')
        .notNullable()
        .references('id')
        .inTable('escalated_import_jobs')
        .onDelete('CASCADE')

      // Entity type: "tickets", "replies", "contacts", "agents", "tags", etc.
      table.string('entity_type').notNullable()

      // Source platform's ID for the record
      table.string('source_id').notNullable()

      // The resulting Escalated-internal ID (stored as string for flexibility)
      table.string('escalated_id').notNullable()

      table.timestamp('created_at', { useTz: true }).notNullable()

      // Lookup index: resolve a source ID → escalated ID within a job
      table.index(['import_job_id', 'entity_type', 'source_id'], 'idx_import_source_lookup')
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
