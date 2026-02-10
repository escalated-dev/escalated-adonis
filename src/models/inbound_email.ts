import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { InboundEmailStatus } from '../types.js'
import Ticket from './ticket.js'
import Reply from './reply.js'

export default class InboundEmail extends BaseModel {
  static table = 'escalated_inbound_emails'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare messageId: string | null

  @column()
  declare fromEmail: string

  @column()
  declare fromName: string | null

  @column()
  declare toEmail: string

  @column()
  declare subject: string

  @column()
  declare bodyText: string | null

  @column()
  declare bodyHtml: string | null

  @column()
  declare rawHeaders: string | null

  @column()
  declare ticketId: number | null

  @column()
  declare replyId: number | null

  @column()
  declare status: InboundEmailStatus

  @column()
  declare adapter: string

  @column()
  declare errorMessage: string | null

  @column.dateTime()
  declare processedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => Ticket, { foreignKey: 'ticketId' })
  declare ticket: BelongsTo<typeof Ticket>

  @belongsTo(() => Reply, { foreignKey: 'replyId' })
  declare reply: BelongsTo<typeof Reply>

  // ---- Scopes ----

  static pending = scope((query) => {
    query.where('status', 'pending')
  })

  static processed = scope((query) => {
    query.where('status', 'processed')
  })

  static failed = scope((query) => {
    query.where('status', 'failed')
  })

  static spam = scope((query) => {
    query.where('status', 'spam')
  })

  static forAdapter = scope((query, adapter: string) => {
    query.where('adapter', adapter)
  })

  // ---- Helpers ----

  async markProcessed(ticketId?: number, replyId?: number): Promise<void> {
    this.status = 'processed'
    if (ticketId !== undefined) this.ticketId = ticketId
    if (replyId !== undefined) this.replyId = replyId
    this.processedAt = DateTime.now()
    await this.save()
  }

  async markFailed(errorMsg: string): Promise<void> {
    this.status = 'failed'
    this.errorMessage = errorMsg
    this.processedAt = DateTime.now()
    await this.save()
  }

  async markSpam(): Promise<void> {
    this.status = 'spam'
    this.processedAt = DateTime.now()
    await this.save()
  }

  isPending(): boolean {
    return this.status === 'pending'
  }

  isProcessed(): boolean {
    return this.status === 'processed'
  }

  isFailed(): boolean {
    return this.status === 'failed'
  }
}
