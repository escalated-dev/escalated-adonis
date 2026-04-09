import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'escalated_workflows'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('trigger_event').notNullable()
      table.json('conditions')
      table.json('actions')
      table.boolean('is_active').defaultTo(true).notNullable()
      table.integer('position').defaultTo(0).notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable('escalated_workflow_logs', (table) => {
      table.increments('id')
      table
        .integer('workflow_id')
        .unsigned()
        .references('id')
        .inTable('escalated_workflows')
        .onDelete('CASCADE')
      table
        .integer('ticket_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
      table.string('trigger_event').notNullable()
      table.string('status').defaultTo('success').notNullable()
      table.json('actions_executed')
      table.text('error_message').nullable()
      table.timestamp('created_at')
    })

    this.schema.createTable('escalated_delayed_actions', (table) => {
      table.increments('id')
      table
        .integer('workflow_id')
        .unsigned()
        .references('id')
        .inTable('escalated_workflows')
        .onDelete('CASCADE')
      table
        .integer('ticket_id')
        .unsigned()
        .references('id')
        .inTable('escalated_tickets')
        .onDelete('CASCADE')
      table.json('action_data').notNullable()
      table.timestamp('execute_at').notNullable()
      table.boolean('executed').defaultTo(false).notNullable()
      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTableIfExists('escalated_delayed_actions')
    this.schema.dropTableIfExists('escalated_workflow_logs')
    this.schema.dropTableIfExists(this.tableName)
  }
}
