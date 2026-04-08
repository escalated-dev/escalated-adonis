import { type DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export interface ChatRoutingCondition {
  field: string
  operator: 'equals' | 'contains' | 'in'
  value: any
}

export interface ChatRoutingAction {
  type: 'assign_department' | 'assign_agent' | 'set_priority'
  value: any
}

export default class ChatRoutingRule extends BaseModel {
  static table = 'escalated_chat_routing_rules'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare priority: number

  @column()
  declare isActive: boolean

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare conditions: ChatRoutingCondition[] | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare actions: ChatRoutingAction[] | null

  @column()
  declare maxChatsPerAgent: number

  @column()
  declare departmentId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
