import { DateTime } from 'luxon'
import { BaseModel, column, hasMany, scope, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { string } from '@adonisjs/core/helpers'
import Ticket from './ticket.js'

export default class Department extends BaseModel {
  static table = 'escalated_departments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @hasMany(() => Ticket, { foreignKey: 'departmentId' })
  declare tickets: HasMany<typeof Ticket>

  // Note: "agents" is a many-to-many with the host app's user model.
  // We handle this through direct pivot table queries.

  // ---- Scopes ----

  static active = scope((query) => {
    query.where('is_active', true)
  })

  // ---- Hooks ----

  @beforeCreate()
  static assignSlug(department: Department) {
    if (!department.slug) {
      department.slug = string.slug(department.name)
    }
  }

  // ---- Helpers for department-agent pivot ----

  async agents(): Promise<any[]> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    return db
      .from('escalated_department_agent')
      .where('department_id', this.id)
      .select('agent_id')
  }

  async attachAgent(agentId: number): Promise<void> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    await db
      .insertQuery()
      .table('escalated_department_agent')
      .insert({ department_id: this.id, agent_id: agentId })
      .onConflict(['department_id', 'agent_id'])
      .ignore()
  }

  async detachAgent(agentId: number): Promise<void> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    await db
      .from('escalated_department_agent')
      .where('department_id', this.id)
      .where('agent_id', agentId)
      .delete()
  }
}
