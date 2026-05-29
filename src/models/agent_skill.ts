import { type DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { UserId } from '../helpers/user_id_column.js'
import Skill from './skill.js'

export default class AgentSkill extends BaseModel {
  static table = 'escalated_agent_skills'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: UserId

  @column()
  declare skillId: number

  @column()
  declare proficiency: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Skill, { foreignKey: 'skillId' })
  declare skill: BelongsTo<typeof Skill>
}
