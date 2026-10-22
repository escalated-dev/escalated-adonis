import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Business schedules and their holidays, as escalated-laravel's
 * `create_escalated_business_schedules_table` and
 * `create_escalated_holidays_table`, plus the nullable references an SLA
 * policy and a department use to pick a schedule.
 *
 * `schedule` is JSON keyed by weekday: { monday: { start: "09:00", end: "17:00" }, ... }.
 * The references are plain nullable columns, not foreign keys, so the same
 * ALTER works on SQLite; deleting a schedule clears them in the controller.
 */
export default class CreateEscalatedBusinessSchedules extends BaseSchema {
  async up() {
    this.schema.createTable('escalated_business_schedules', (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('timezone').notNullable().defaultTo('UTC')
      table.boolean('is_default').notNullable().defaultTo(false)
      table.json('schedule').notNullable()
      table.timestamp('created_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
    })

    this.schema.createTable('escalated_holidays', (table) => {
      table.increments('id')
      table
        .integer('schedule_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('escalated_business_schedules')
        .onDelete('CASCADE')
      table.string('name').notNullable()
      table.date('date').notNullable()
      table.boolean('recurring').notNullable().defaultTo(false)
      table.timestamp('created_at', { useTz: true }).nullable()
      table.timestamp('updated_at', { useTz: true }).nullable()
      table.index(['schedule_id'], 'escalated_holidays_schedule_idx')
    })

    this.schema.alterTable('escalated_sla_policies', (table) => {
      table.integer('business_schedule_id').unsigned().nullable()
    })

    this.schema.alterTable('escalated_departments', (table) => {
      table.integer('business_schedule_id').unsigned().nullable()
    })
  }

  async down() {
    this.schema.alterTable('escalated_departments', (table) => {
      table.dropColumn('business_schedule_id')
    })
    this.schema.alterTable('escalated_sla_policies', (table) => {
      table.dropColumn('business_schedule_id')
    })
    this.schema.dropTable('escalated_holidays')
    this.schema.dropTable('escalated_business_schedules')
  }
}
