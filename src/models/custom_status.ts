import { type DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'
import type { TicketStatus } from '../types.js'
import {
  CATEGORY_ANCHORS,
  builtInCategory,
  isBuiltInStatus,
  isStatusCategory,
  slugify,
  type CustomStatusSummary,
  type StatusCategory,
} from '../support/custom_statuses.js'

/**
 * Where a status change lands: the built-in status the ticket takes, and the
 * custom status it records (null for a built-in).
 */
export type StatusTarget = { status: TicketStatus; custom: CustomStatus | null }

/**
 * A ticket status an admin defined (`escalated_ticket_statuses`), plus one
 * system row per built-in status. See src/support/custom_statuses.ts.
 */
export default class CustomStatus extends EscalatedBaseModel {
  static table = 'escalated_ticket_statuses'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare label: string

  @column()
  declare slug: string

  @column()
  declare category: StatusCategory

  @column()
  declare color: string

  @column()
  declare description: string | null

  @column({ consume: (value: any) => Number(value ?? 0) })
  declare position: number

  @column({ consume: (value: any) => Boolean(value) })
  declare isDefault: boolean

  @column({ consume: (value: any) => Boolean(value) })
  declare isSystem: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /** The built-in status a ticket takes with this status. */
  get anchor(): TicketStatus {
    if (this.isSystem && isBuiltInStatus(this.slug)) return this.slug
    return isStatusCategory(this.category) ? CATEGORY_ANCHORS[this.category] : 'open'
  }

  summary(): CustomStatusSummary {
    return {
      id: this.id,
      label: this.label,
      slug: this.slug,
      color: this.color,
      category: this.category,
    }
  }

  /** The admin pages' shape (escalated-laravel's TicketStatus serialized). */
  toAdminRow() {
    return {
      id: this.id,
      label: this.label,
      slug: this.slug,
      category: this.category,
      color: this.color,
      description: this.description ?? null,
      position: Number(this.position ?? 0),
      is_default: Boolean(this.isDefault),
      is_system: Boolean(this.isSystem),
      created_at: this.createdAt?.toISO() ?? null,
      updated_at: this.updatedAt?.toISO() ?? null,
    }
  }

  /**
   * Resolve what a status-change input names: a built-in value, a custom
   * status slug, or a CustomStatus. A system row is its built-in. Anything
   * else comes back unchanged as the status, so the transition check rejects
   * it as it always has.
   */
  static async resolveTarget(value: unknown): Promise<StatusTarget> {
    if (value instanceof CustomStatus) {
      return value.isSystem && isBuiltInStatus(value.slug)
        ? { status: value.slug, custom: null }
        : { status: value.anchor, custom: value }
    }
    if (isBuiltInStatus(value)) return { status: value, custom: null }
    if (typeof value === 'string' && value !== '') {
      const custom = await CustomStatus.query()
        .where('slug', value)
        .where('is_system', false)
        .first()
      if (custom) return { status: custom.anchor, custom }
    }
    return { status: value as TicketStatus, custom: null }
  }

  /** The category of a ticket's effective status: its custom status's, else its built-in's. */
  static categoryOf(status: string, custom: CustomStatus | null | undefined): StatusCategory {
    return custom && isStatusCategory(custom.category) ? custom.category : builtInCategory(status)
  }

  /**
   * A slug that no other row has: the slug of `source`, then `_2`, `_3`...
   * The built-ins are rows too, so a custom status cannot take their slugs.
   */
  static async uniqueSlug(source: string, exceptId?: number): Promise<string> {
    const base = slugify(source) || 'status'
    // A prefix match (LIKE's `_` matches any character, so this over-selects),
    // narrowed to exact names below.
    const rows = await CustomStatus.query()
      .where('slug', 'like', `${base}%`)
      .if(exceptId !== undefined, (q) => q.whereNot('id', exceptId!))
      .select('slug')
    const taken = new Set(rows.map((row) => row.slug))
    if (!taken.has(base)) return base
    let suffix = 2
    while (taken.has(`${base}_${suffix}`)) suffix++
    return `${base}_${suffix}`
  }
}
