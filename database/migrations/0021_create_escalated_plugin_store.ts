import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateEscalatedPluginStore extends BaseSchema {
  protected tableName = 'escalated_plugin_store'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      // Plugin identifier — matches the npm package name
      table.string('plugin').notNullable()

      // Logical collection within the plugin (e.g. "settings", "__config__")
      table.string('collection').notNullable()

      // Optional key within the collection — used for keyed get/set/update/delete
      table.string('key').nullable()

      // Arbitrary JSON payload
      table.text('data').nullable()

      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      // Fast keyed lookups
      table.index(['plugin', 'collection', 'key'], 'idx_plugin_store_lookup')

      // Collection scans (e.g. store.query())
      table.index(['plugin', 'collection'], 'idx_plugin_store_collection')
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
