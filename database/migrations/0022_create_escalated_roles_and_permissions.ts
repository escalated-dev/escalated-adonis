import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedRolesAndPermissions extends BaseSchema {
  async up() {
    this.schema.createTable('escalated_permissions', (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('slug').unique().notNullable()
      table.string('group').nullable()
      table.text('description').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('escalated_roles', (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('slug').unique().notNullable()
      table.text('description').nullable()
      table.boolean('is_system').defaultTo(false)
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('escalated_role_permissions', (table) => {
      table
        .integer('role_id')
        .unsigned()
        .references('id')
        .inTable('escalated_roles')
        .onDelete('CASCADE')
      table
        .integer('permission_id')
        .unsigned()
        .references('id')
        .inTable('escalated_permissions')
        .onDelete('CASCADE')
      table.primary(['role_id', 'permission_id'])
    })

    this.schema.createTable('escalated_role_users', (table) => {
      table
        .integer('role_id')
        .unsigned()
        .references('id')
        .inTable('escalated_roles')
        .onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable()
      table.primary(['role_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTableIfExists('escalated_role_users')
    this.schema.dropTableIfExists('escalated_role_permissions')
    this.schema.dropTableIfExists('escalated_roles')
    this.schema.dropTableIfExists('escalated_permissions')
  }
}
