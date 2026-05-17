import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Skill from './skill.js'
import Tag from './tag.js'

export default class SkillRoutingTag extends BaseModel {
  static table = 'escalated_skill_routing_tags'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare skillId: number

  @column()
  declare tagId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Skill, { foreignKey: 'skillId' })
  declare skill: BelongsTo<typeof Skill>

  @belongsTo(() => Tag, { foreignKey: 'tagId' })
  declare tag: BelongsTo<typeof Tag>
}
