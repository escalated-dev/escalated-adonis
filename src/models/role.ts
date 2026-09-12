import { type DateTime } from 'luxon'
import { column, manyToMany } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Permission from './permission.js'

export default class Role extends EscalatedBaseModel {
  static table = 'escalated_roles'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare isSystem: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @manyToMany(() => Permission, {
    pivotTable: 'escalated_role_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
  })
  declare permissions: ManyToMany<typeof Permission>
}
