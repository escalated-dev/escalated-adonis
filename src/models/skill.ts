import { type DateTime } from 'luxon'
import { BaseModel, column, hasMany, manyToMany, beforeCreate } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import string from '@adonisjs/core/helpers/string'
import Tag from './tag.js'
import Department from './department.js'
import AgentSkill from './agent_skill.js'
import SkillRoutingTag from './skill_routing_tag.js'
import SkillRoutingDepartment from './skill_routing_department.js'

export default class Skill extends BaseModel {
  static table = 'escalated_skills'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare slug: string

  @column()
  declare description: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => AgentSkill, { foreignKey: 'skillId' })
  declare agentSkills: HasMany<typeof AgentSkill>

  @hasMany(() => SkillRoutingTag, { foreignKey: 'skillId' })
  declare skillRoutingTags: HasMany<typeof SkillRoutingTag>

  @hasMany(() => SkillRoutingDepartment, { foreignKey: 'skillId' })
  declare skillRoutingDepartments: HasMany<typeof SkillRoutingDepartment>

  @manyToMany(() => Tag, {
    pivotTable: 'escalated_skill_routing_tags',
    pivotForeignKey: 'skill_id',
    pivotRelatedForeignKey: 'tag_id',
  })
  declare routingTags: ManyToMany<typeof Tag>

  @manyToMany(() => Department, {
    pivotTable: 'escalated_skill_routing_departments',
    pivotForeignKey: 'skill_id',
    pivotRelatedForeignKey: 'department_id',
  })
  declare routingDepartments: ManyToMany<typeof Department>

  @beforeCreate()
  static assignSlugOnCreate(skill: Skill) {
    if (!skill.slug) {
      skill.slug = string.slug(skill.name)
    }
  }
}
