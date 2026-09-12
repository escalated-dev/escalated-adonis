import { type DateTime } from 'luxon'
import { column, manyToMany } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Role from './role.js'

export default class Permission extends EscalatedBaseModel {
  static table = 'escalated_permissions'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare group: string | null

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @manyToMany(() => Role, {
    pivotTable: 'escalated_role_permissions',
    pivotForeignKey: 'permission_id',
    pivotRelatedForeignKey: 'role_id',
  })
  declare roles: ManyToMany<typeof Role>
}
