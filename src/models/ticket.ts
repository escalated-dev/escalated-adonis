import {
  assertTicketAccess,
  withoutTicketAccess,
  resolveTicketAccount,
  restrictedTicketAccess,
  ticketUser,
  userCanAccessTicket,
} from '../support/ticket_access.js'
import { escalatedDb, getConfig } from '../helpers/config.js'
import { type DateTime } from 'luxon'
import {
  column,
  beforeCreate,
  beforeUpdate,
  afterCreate,
  belongsTo,
  hasMany,
  hasOne,
  manyToMany,
  computed,
  scope,
} from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { BelongsTo, HasMany, HasOne, ManyToMany } from '@adonisjs/lucid/types/relations'
import type { TicketStatus, TicketPriority } from '../types.js'
import type { UserId } from '../helpers/user_id_column.js'
import { followerRecipients } from '../services/follower_recipients.js'
import { canTransitionTo, isOpenStatus } from '../types.js'
import Reply from './reply.js'
import Department from './department.js'
import SlaPolicy from './sla_policy.js'
import Tag from './tag.js'
import TicketActivity from './ticket_activity.js'
import Attachment from './attachment.js'
import SatisfactionRating from './satisfaction_rating.js'
import EscalatedSetting from './escalated_setting.js'
import TicketSubjectLink from './ticket_subject_link.js'
import { assertTicketSubjectTypeAllowed } from '../services/ticket_subject_service.js'
import type { TicketSubjectSyncItem } from '../contracts/ticket_subject.js'

export default class Ticket extends EscalatedBaseModel {
  static table = 'escalated_tickets'

  static TYPES = ['question', 'problem', 'incident', 'task'] as const

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reference: string

  @column()
  declare requesterType: string | null

  @column()
  declare requesterId: UserId | null

  @column()
  declare assignedTo: UserId | null

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
  declare accountType: string | null

  @column()
  declare accountId: string | null

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

  // Verified guest access (docs/guest-access.md). Only the hash of the
  // grant's nonce and a keyed digest of the verified address are stored.
  @column({ serializeAs: null })
  declare guestAccessHash: string | null

  @column.dateTime({ serializeAs: null })
  declare guestAccessExpiresAt: DateTime | null

  @column({ serializeAs: null })
  declare guestVerifiedEmail: string | null

  @column.dateTime({ serializeAs: null })
  declare guestEmailVerifiedAt: DateTime | null

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
  declare snoozedBy: UserId | null

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

  /** Files attached to the ticket itself (replies hold their own). */
  @hasMany(() => Attachment, {
    foreignKey: 'attachableId',
    onQuery: (query) => {
      query.where('attachable_type', 'Ticket')
    },
  })
  declare attachments: HasMany<typeof Attachment>

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

  @hasMany(() => TicketSubjectLink, { foreignKey: 'ticketId' })
  declare subjects: HasMany<typeof TicketSubjectLink>

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
    // Verified guest tickets no longer keep a permanent token.
    return this.requesterType === null && (this.guestToken !== null || !!this.guestEmail)
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
    // referred to a non-existent TicketStatus value â€” chat-session liveness
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

  static assignedToAgent = scope((query, agentId: UserId) => {
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

  @beforeCreate()
  static async resolveAccount(ticket: Ticket) {
    if (
      !ticket.accountType &&
      !ticket.accountId &&
      ticket.requesterType &&
      ticket.requesterId !== null &&
      ticket.requesterId !== undefined
    ) {
      const account = await resolveTicketAccount({
        kind: 'requester',
        type: ticket.requesterType,
        id: ticket.requesterId,
      })
      ticket.accountType = account?.type ?? null
      ticket.accountId = account ? String(account.id) : null
    }
  }

  /**
   * Changing the guest email revokes its proof and every grant: the new
   * address has not been verified.
   */
  @beforeUpdate()
  static revokeGuestAccessOnEmailChange(ticket: Ticket) {
    if (!('guestEmail' in ticket.$dirty)) return
    ticket.guestAccessHash = null
    ticket.guestAccessExpiresAt = null
    ticket.guestVerifiedEmail = null
    ticket.guestEmailVerifiedAt = null
    ticket.guestToken = null
  }

  @afterCreate()
  static async attachTargetedSla(ticket: Ticket) {
    if (getConfig().targetedSlas && getConfig().sla?.enabled) {
      const { default: SlaService } = await import('../services/sla_service.js')
      await new SlaService().attachDefaultPolicy(ticket)
    }
  }

  static async generateReference(): Promise<string> {
    const prefix = await EscalatedSetting.get('ticket_reference_prefix', 'ESC')
    const latest = await withoutTicketAccess(() => Ticket.query().max('id as max_id').first())

    const nextId = ((latest as any)?.$extras?.max_id ?? 0) + 1
    return `${prefix}-${String(nextId).padStart(5, '0')}`
  }

  async isFollowedBy(userId: UserId): Promise<boolean> {
    const db = await escalatedDb()
    const row = await db
      .from('escalated_ticket_followers')
      .where('ticket_id', this.id)
      .where('user_id', userId)
      .first()
    return !!row
  }

  async follow(userId: UserId): Promise<void> {
    const db = await escalatedDb()
    // Lucid's `InsertQueryBuilderContract` doesn't expose `onConflict` â€”
    // drop into the underlying Knex builder for the upsert-ignore.
    await db
      .knexQuery()
      .table('escalated_ticket_followers')
      .insert({ ticket_id: this.id, user_id: userId })
      .onConflict(['ticket_id', 'user_id'])
      .ignore()
  }

  async unfollow(userId: UserId): Promise<void> {
    const db = await escalatedDb()
    await db
      .from('escalated_ticket_followers')
      .where('ticket_id', this.id)
      .where('user_id', userId)
      .delete()
  }

  async followersCount(): Promise<number> {
    const db = await escalatedDb()
    const result = await db
      .from('escalated_ticket_followers')
      .where('ticket_id', this.id)
      .count('* as total')
      .first()
    return Number(result?.total ?? 0)
  }

  /**
   * Host-user ids following this ticket, excluding the actor and de-duplicated.
   * Ridden along on the reply/status events so the host can notify them â€” the
   * package has no user emails of its own. See issue #94.
   */
  async followerUserIds(excludeUserId?: UserId): Promise<UserId[]> {
    const db = await escalatedDb()
    const rows = await db
      .from('escalated_ticket_followers')
      .where('ticket_id', this.id)
      .select('user_id')
    const recipients = followerRecipients(
      rows.map((row) => row.user_id as UserId),
      excludeUserId
    )
    if (!restrictedTicketAccess()) return recipients
    const allowed: UserId[] = []
    for (const id of recipients) {
      const user = await ticketUser(id)
      if (user && (await userCanAccessTicket(user, this))) allowed.push(id)
    }
    return allowed
  }

  /**
   * Attach a host entity as a subject (idempotent on ticket+type+id).
   * Rejects types outside the configured allowlist when one is set.
   */
  async attachSubject(
    subjectType: string,
    subjectId: string | number,
    role: string | null = null,
    position?: number
  ): Promise<TicketSubjectLink> {
    await assertTicketAccess(this)
    assertTicketSubjectTypeAllowed(subjectType)
    const account =
      !this.accountType && !this.accountId
        ? await resolveTicketAccount({ kind: 'subject', type: subjectType, id: subjectId })
        : null
    const attach = async (client: any): Promise<TicketSubjectLink> => {
      const id = String(subjectId)
      let link = await TicketSubjectLink.query({ client })
        .where('ticket_id', this.id)
        .where('subject_type', subjectType)
        .where('subject_id', id)
        .first()
      if (link) {
        link.role = role
        if (position !== undefined) link.position = position
        await link.save()
      } else {
        let nextPosition = position
        if (nextPosition === undefined) {
          const maxRow = await TicketSubjectLink.query({ client })
            .where('ticket_id', this.id)
            .max('position as max_position')
            .first()
          nextPosition = Number(maxRow?.$extras.max_position ?? -1) + 1
        }
        link = await TicketSubjectLink.create(
          { ticketId: this.id, subjectType, subjectId: id, role, position: nextPosition },
          { client }
        )
      }
      if (account) {
        await Ticket.query({ client })
          .where('id', this.id)
          .whereNull('account_type')
          .whereNull('account_id')
          .update({ accountType: account.type, accountId: String(account.id) })
        const stored = await Ticket.query({ client }).where('id', this.id).firstOrFail()
        this.accountType = stored.accountType
        this.accountId = stored.accountId
      }
      return link
    }
    if (this.$trx) return attach(this.$trx)
    const db = await escalatedDb()
    return db.transaction(attach)
  }

  /**
   * Detach a subject by type+id. Returns the number of links removed (0 or 1).
   */
  async detachSubject(subjectType: string, subjectId: string | number): Promise<number> {
    const deleted = await TicketSubjectLink.query()
      .where('ticket_id', this.id)
      .where('subject_type', subjectType)
      .where('subject_id', String(subjectId))
      .delete()

    return Number(deleted[0] ?? 0)
  }

  /**
   * Replace this ticket's subjects, preserving order.
   */
  async syncSubjects(items: TicketSubjectSyncItem[]): Promise<void> {
    await TicketSubjectLink.query().where('ticket_id', this.id).delete()

    let position = 0
    for (const entry of items) {
      const [type, id, role] = Array.isArray(entry) ? entry : [entry.type, entry.id, entry.role]
      await this.attachSubject(type, id, role ?? null, position++)
    }
  }
}
