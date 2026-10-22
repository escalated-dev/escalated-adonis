import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Custom fields (definitions + per-entity values) and custom objects (an
 * admin-defined schema + its records). Mirrors escalated-laravel's
 * `create_escalated_custom_fields_table`, `add_conditions_to_escalated_custom_fields`
 * and `create_escalated_custom_objects_tables` migrations.
 *
 * `entity_id` is a string so a value can belong to an entity keyed by an
 * integer (tickets) or by a host's string/UUID user key.
 */
export default class CreateEscalatedCustomFields extends BaseSchema {
  async up() {
    this.schema.createTable('escalated_custom_fields', (table) => {
      table.increments('id')
      table.string('name', 255).notNullable()
      table.string('slug', 255).notNullable()
      table.string('type', 32).notNullable()
      table.string('context', 32).notNullable().defaultTo('ticket')
      table.json('options').nullable()
      table.boolean('required').notNullable().defaultTo(false)
      table.string('placeholder', 255).nullable()
      table.text('description').nullable()
      table.json('validation_rules').nullable()
      table.json('conditions').nullable()
      table.integer('position').notNullable().defaultTo(0)
      table.boolean('active').notNullable().defaultTo(true)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['slug'], { indexName: 'escalated_custom_fields_slug_unique' })
      table.index(['context', 'active'], 'escalated_custom_fields_context_active_idx')
    })

    this.schema.createTable('escalated_custom_field_values', (table) => {
      table.increments('id')
      table
        .integer('custom_field_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('escalated_custom_fields')
        .onDelete('CASCADE')
      table.string('entity_type', 64).notNullable()
      table.string('entity_id', 64).notNullable()
      table.text('value').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['custom_field_id', 'entity_type', 'entity_id'], {
        indexName: 'escalated_cf_values_field_entity_unique',
      })
      table.index(['entity_type', 'entity_id'], 'escalated_cf_values_entity_idx')
    })

    this.schema.createTable('escalated_custom_objects', (table) => {
      table.increments('id')
      table.string('name', 255).notNullable()
      table.string('slug', 100).notNullable()
      table.json('fields_schema').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['slug'], { indexName: 'escalated_custom_objects_slug_unique' })
    })

    this.schema.createTable('escalated_custom_object_records', (table) => {
      table.increments('id')
      table
        .integer('object_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('escalated_custom_objects')
        .onDelete('CASCADE')
      table.json('data').notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['object_id'], 'escalated_custom_object_records_object_idx')
    })
  }

  async down() {
    this.schema.dropTableIfExists('escalated_custom_object_records')
    this.schema.dropTableIfExists('escalated_custom_objects')
    this.schema.dropTableIfExists('escalated_custom_field_values')
    this.schema.dropTableIfExists('escalated_custom_fields')
  }
}
