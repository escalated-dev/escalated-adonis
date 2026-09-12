import { type DateTime } from 'luxon'
import { column, belongsTo } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Skill from './skill.js'
import Department from './department.js'

export default class SkillRoutingDepartment extends EscalatedBaseModel {
  static table = 'escalated_skill_routing_departments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare skillId: number

  @column()
  declare departmentId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Skill, { foreignKey: 'skillId' })
  declare skill: BelongsTo<typeof Skill>

  @belongsTo(() => Department, { foreignKey: 'departmentId' })
  declare department: BelongsTo<typeof Department>
}
