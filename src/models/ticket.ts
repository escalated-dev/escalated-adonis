import { type DateTime } from 'luxon'
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
import type { BelongsTo, HasMany, HasOne, ManyToMany } from '@adonisjs/lucid/types/relations'
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

  static TYPES = ['question', 'problem', 'incident', 'task'] as const

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
  declare ticketType: string

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
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare metadata: Record<string, any> | null

  // Guest ticket fields (Pattern A, preserved for backwards compatibility)
  @column()
  declare guestName: string | null

  @column()
  declare guestEmail: string | null

  @column()
  declare guestToken: string | null

  // First-class Contact FK (Pattern B convergence)
  @column({ columnName: 'contact_id' })
  declare contactId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @column.dateTime()
  declare snoozedUntil: DateTime | null

  @column()
  declare snoozedBy: number | null

  @column()
  declare statusBeforeSnooze: string | null

  @column.dateTime()
  declare chatEndedAt: DateTime | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare chatMetadata: Record<string, any> | null

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
  get isSnoozed(): boolean {
    if (!this.snoozedUntil) return false
    const now = new Date()
    const snoozedUntil =
      this.snoozedUntil instanceof Date
        ? this.snoozedUntil
        : new Date(this.snoozedUntil.toISO!() ?? this.snoozedUntil.toString())
    return snoozedUntil > now
  }

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
  get isLiveChat(): boolean {
    // A "live" chat ticket is one whose channel is chat and whose status
    // hasn't been resolved/closed. (The earlier check for status === 'live'
    // referred to a non-existent TicketStatus value — chat-session liveness
    // lives on `ChatSession.status`, not on the ticket itself.)
    return this.channel === 'chat' && this.status !== 'resolved' && this.status !== 'closed'
  }

  @computed()
  get lastReplyAt(): string | null {
    // Prefer $extras populated by a subquery; fall back to preloaded replies
    if ((this as any).$extras?.last_reply_at) {
      return (this as any).$extras.last_reply_at
    }
    const replies = Array.isArray(this.replies) ? this.replies : []
    if (replies.length > 0) {
      // replies may be ordered desc already; pick the most recent
      const sorted = [...replies].sort(
        (a: any, b: any) =>
          new Date(b.createdAt?.toISO?.() ?? b.createdAt).getTime() -
          new Date(a.createdAt?.toISO?.() ?? a.createdAt).getTime()
      )
      const ts = sorted[0].createdAt
      return ts?.toISO?.() ?? ts?.toString() ?? null
    }
    return null
  }

  @computed()
  get lastReplyAuthor(): string | null {
    // Prefer $extras populated by a subquery; fall back to preloaded replies
    if ((this as any).$extras?.last_reply_author) {
      return (this as any).$extras.last_reply_author
    }
    return null
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

  static snoozed = scope((query) => {
    query.whereNotNull('snoozed_until').where('snoozed_until', '>', new Date().toISOString())
  })

  static awakeDue = scope((query) => {
    query.whereNotNull('snoozed_until').where('snoozed_until', '<=', new Date().toISOString())
  })

  static breachedSla = scope((query) => {
    query.where((q) => {
      q.where('sla_first_response_breached', true).orWhere('sla_resolution_breached', true)
    })
  })

  static liveChat = scope((query) => {
    query.where('channel', 'chat')
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
    const latest = await Ticket.query().max('id as max_id').first()

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
    // Lucid's `InsertQueryBuilderContract` doesn't expose `onConflict` —
    // drop into the underlying Knex builder for the upsert-ignore.
    await db
      .knexQuery()
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
