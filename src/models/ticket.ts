import { DateTime } from 'luxon'
import {
  BaseModel,
  column,
  belongsTo,
  hasMany,
  hasOne,
  manyToMany,
  computed,
  scope,
} from '@adonisjs/lucid/orm'
import type {
  BelongsTo,
  HasMany,
  HasOne,
  ManyToMany,
} from '@adonisjs/lucid/types/relations'
import type { TicketStatus, TicketPriority } from '../types.js'
import { canTransitionTo, isOpenStatus } from '../types.js'
import Reply from './reply.js'
import Department from './department.js'
import SlaPolicy from './sla_policy.js'
import Tag from './tag.js'
import TicketActivity from './ticket_activity.js'
import Attachment from './attachment.js'
import SatisfactionRating from './satisfaction_rating.js'
import EscalatedSetting from './escalated_setting.js'

export default class Ticket extends BaseModel {
  static table = 'escalated_tickets'

  static selfAssignPrimaryKey = true

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reference: string

  @column()
  declare requesterType: string | null

  @column()
  declare requesterId: number | null

  @column()
  declare assignedTo: number | null

  @column()
  declare subject: string

  @column()
  declare description: string

  @column()
  declare status: TicketStatus

  @column()
  declare priority: TicketPriority

  @column()
  declare channel: string

  @column()
  declare departmentId: number | null

  @column()
  declare slaPolicyId: number | null

  @column.dateTime()
  declare firstResponseAt: DateTime | null

  @column.dateTime()
  declare firstResponseDueAt: DateTime | null

  @column.dateTime()
  declare resolutionDueAt: DateTime | null

  @column()
  declare slaFirstResponseBreached: boolean

  @column()
  declare slaResolutionBreached: boolean

  @column.dateTime()
  declare resolvedAt: DateTime | null

  @column.dateTime()
  declare closedAt: DateTime | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (value ? (typeof value === 'string' ? JSON.parse(value) : value) : null),
  })
  declare metadata: Record<string, any> | null

  // Guest ticket fields
  @column()
  declare guestName: string | null

  @column()
  declare guestEmail: string | null

  @column()
  declare guestToken: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare deletedAt: DateTime | null

  // ---- Relationships ----

  @belongsTo(() => Department, { foreignKey: 'departmentId' })
  declare department: BelongsTo<typeof Department>

  @belongsTo(() => SlaPolicy, { foreignKey: 'slaPolicyId' })
  declare slaPolicy: BelongsTo<typeof SlaPolicy>

  @hasMany(() => Reply, { foreignKey: 'ticketId' })
  declare replies: HasMany<typeof Reply>

  @hasMany(() => TicketActivity, { foreignKey: 'ticketId' })
  declare activities: HasMany<typeof TicketActivity>

  @manyToMany(() => Tag, {
    pivotTable: 'escalated_ticket_tag',
    pivotForeignKey: 'ticket_id',
    pivotRelatedForeignKey: 'tag_id',
  })
  declare tags: ManyToMany<typeof Tag>

  @hasOne(() => SatisfactionRating, { foreignKey: 'ticketId' })
  declare satisfactionRating: HasOne<typeof SatisfactionRating>

  // Note: "requester" and "assignee" are polymorphic / dynamic user model
  // references. We handle these by manually loading via the user model.

  // Note: "followers" is a many-to-many with the host app's user model.
  // We handle this through direct pivot table queries.

  // ---- Computed ----

  @computed()
  get isGuest(): boolean {
    return this.requesterType === null && this.guestToken !== null
  }

  @computed()
  get requesterName(): string {
    if (this.isGuest) {
      return this.guestName ?? 'Guest'
    }
    return (this as any).$extras?.requester_name ?? 'Unknown'
  }

  @computed()
  get requesterEmail(): string {
    if (this.isGuest) {
      return this.guestEmail ?? ''
    }
    return (this as any).$extras?.requester_email ?? ''
  }

  // ---- Scopes ----

  static open = scope((query) => {
    query.whereNotIn('status', ['resolved', 'closed'])
  })

  static unassigned = scope((query) => {
    query.whereNull('assigned_to')
  })

  static assignedToAgent = scope((query, agentId: number) => {
    query.where('assigned_to', agentId)
  })

  static withStatus = scope((query, status: TicketStatus) => {
    query.where('status', status)
  })

  static withPriority = scope((query, priority: TicketPriority) => {
    query.where('priority', priority)
  })

  static inDepartment = scope((query, departmentId: number) => {
    query.where('department_id', departmentId)
  })

  static breachedSla = scope((query) => {
    query.where((q) => {
      q.where('sla_first_response_breached', true)
        .orWhere('sla_resolution_breached', true)
    })
  })

  static search = scope((query, term: string) => {
    query.where((q) => {
      q.where('subject', 'like', `%${term}%`)
        .orWhere('reference', 'like', `%${term}%`)
        .orWhere('description', 'like', `%${term}%`)
    })
  })

  // ---- Helper Methods ----

  canTransitionTo(targetStatus: TicketStatus): boolean {
    return canTransitionTo(this.status, targetStatus)
  }

  isOpen(): boolean {
    return isOpenStatus(this.status)
  }

  static async generateReference(): Promise<string> {
    const prefix = await EscalatedSetting.get('ticket_reference_prefix', 'ESC')
    const latest = await Ticket.query()
      .max('id as max_id')
      .first()

    const nextId = ((latest as any)?.$extras?.max_id ?? 0) + 1
    return `${prefix}-${String(nextId).padStart(5, '0')}`
  }

  async isFollowedBy(userId: number): Promise<boolean> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const row = await db
      .from('escalated_ticket_followers')
      .where('ticket_id', this.id)
      .where('user_id', userId)
      .first()
    return !!row
  }

  async follow(userId: number): Promise<void> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    await db
      .insertQuery()
      .table('escalated_ticket_followers')
      .insert({ ticket_id: this.id, user_id: userId })
      .onConflict(['ticket_id', 'user_id'])
      .ignore()
  }

  async unfollow(userId: number): Promise<void> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    await db
      .from('escalated_ticket_followers')
      .where('ticket_id', this.id)
      .where('user_id', userId)
      .delete()
  }

  async followersCount(): Promise<number> {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const result = await db
      .from('escalated_ticket_followers')
      .where('ticket_id', this.id)
      .count('* as total')
      .first()
    return Number(result?.total ?? 0)
  }
}
