import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedTickets extends BaseSchema {
  protected tableName = 'escalated_tickets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('reference').unique().notNullable()
      table.string('requester_type').nullable()
      table.integer('requester_id').unsigned().nullable()
      table.string('guest_name').nullable()
      table.string('guest_email').nullable()
      table.string('guest_token', 64).nullable().unique()
      table.integer('assigned_to').unsigned().nullable().index()
      table.string('subject').notNullable()
      table.text('description').notNullable()
      table.string('status').defaultTo('open').index().notNullable()
      table.string('priority').defaultTo('medium').index().notNullable()
      table.string('channel').defaultTo('web').notNullable()
      table.integer('department_id').unsigned().nullable().index()
      table.integer('sla_policy_id').unsigned().nullable()
      table.timestamp('first_response_at', { useTz: true }).nullable()
      table.timestamp('first_response_due_at', { useTz: true }).nullable()
      table.timestamp('resolution_due_at', { useTz: true }).nullable()
      table.boolean('sla_first_response_breached').defaultTo(false)
      table.boolean('sla_resolution_breached').defaultTo(false)
      table.timestamp('resolved_at', { useTz: true }).nullable()
      table.timestamp('closed_at', { useTz: true }).nullable()
      table.json('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
      table.timestamp('deleted_at', { useTz: true }).nullable()

      table.index(['requester_type', 'requester_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
