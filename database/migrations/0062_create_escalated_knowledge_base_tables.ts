import { BaseSchema } from '@adonisjs/lucid/schema'
import { userIdColumn } from '../../src/helpers/user_id_column.js'

export default class CreateEscalatedKnowledgeBaseTables extends BaseSchema {
  protected categoriesTable = 'escalated_article_categories'
  protected articlesTable = 'escalated_articles'

  async up() {
    this.schema.createTable(this.categoriesTable, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('slug').notNullable().unique()
      table
        .integer('parent_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable(this.categoriesTable)
        .onDelete('SET NULL')
      table.integer('position').unsigned().notNullable().defaultTo(0)
      table.text('description').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable(this.articlesTable, (table) => {
      table.increments('id')
      table
        .integer('category_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable(this.categoriesTable)
        .onDelete('SET NULL')
      table.string('title').notNullable()
      table.string('slug').notNullable().unique()
      table.text('body', 'longtext').nullable()
      table.string('status').notNullable().defaultTo('draft')
      userIdColumn(table, 'author_id').nullable()
      table.integer('view_count').unsigned().notNullable().defaultTo(0)
      table.integer('helpful_count').unsigned().notNullable().defaultTo(0)
      table.integer('not_helpful_count').unsigned().notNullable().defaultTo(0)
      table.timestamp('published_at', { useTz: true }).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.index(['status', 'published_at'])
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.articlesTable)
    this.schema.dropTableIfExists(this.categoriesTable)
  }
}
