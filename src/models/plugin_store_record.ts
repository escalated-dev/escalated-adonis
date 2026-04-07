/*
|--------------------------------------------------------------------------
| PluginStoreRecord
|--------------------------------------------------------------------------
|
| Lucid model for the escalated_plugin_store table.
|
| Stores arbitrary JSON data for SDK plugins — used by ctx.store.*,
| ctx.config.get/set/all, and related DataStore operations.
|
| Schema
| ──────
| id          — auto-increment PK
| plugin      — plugin name (e.g. "@escalated-dev/plugin-slack")
| collection  — logical grouping within a plugin (e.g. "webhooks", "__config__")
| key         — optional unique key within the collection (nullable)
| data        — JSON blob (stored as TEXT, serialized/deserialized automatically)
| created_at
| updated_at
|
*/

import { type DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class PluginStoreRecord extends BaseModel {
  static table = 'escalated_plugin_store'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare plugin: string

  @column()
  declare collection: string

  @column()
  declare key: string | null

  @column({
    prepare: (value: unknown) => (value !== undefined ? JSON.stringify(value) : null),
    consume: (value: unknown) => {
      if (value === null || value === undefined) return null
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return value
        }
      }
      return value
    },
  })
  declare data: unknown

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
