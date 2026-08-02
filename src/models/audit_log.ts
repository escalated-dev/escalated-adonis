import { type DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { UserId } from '../helpers/user_id_column.js'

/**
 * A system-wide audit trail entry. Records admin / config / security / user
 * actions that happen outside a single ticket (per-ticket history lives on
 * `escalated_ticket_activities`).
 *
 * Ports the Laravel `AuditLog` model. The log is append-only, so it has a
 * `created_at` but no `updated_at`. `userId` is the actor (a host user);
 * `auditableType` / `auditableId` are the polymorphic target.
 */
export default class AuditLog extends BaseModel {
  static table = 'escalated_audit_logs'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: UserId | null

  @column()
  declare action: string

  @column()
  declare auditableType: string | null

  @column()
  declare auditableId: string | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare oldValues: Record<string, any> | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare newValues: Record<string, any> | null

  @column()
  declare ipAddress: string | null

  @column()
  declare userAgent: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Note: no updated_at — audit rows are immutable once written.
  // "auditable" is a polymorphic reference to the host app's model/user;
  // resolution of the actor's display name is done in the admin controller.
}
