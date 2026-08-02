/*
|--------------------------------------------------------------------------
| Audit log — pure helpers
|--------------------------------------------------------------------------
|
| System-wide audit trail. Where `escalated_ticket_activities` records
| per-ticket history, this records admin/config/security/user actions that
| happen outside a single ticket.
|
| This module holds the framework-free logic (row normalization, attribute
| diffing, list filtering) so it can be unit-tested without Lucid or HTTP —
| mirroring how `support/webhook_events.ts` extracts the webhook logic. The
| Lucid persistence lives in `services/audit_service.ts`.
|
| Ports the Laravel `Auditable` trait + `Admin\AuditLogController` contract.
|
*/

import type { UserId } from '../helpers/user_id_column.js'

/**
 * Well-known audit action names emitted across the admin / security surface.
 *
 * The three generic verbs (created/updated/deleted) mirror the Laravel
 * `Auditable` trait; the namespaced actions mirror the explicit
 * `AuditLog::create` calls in the reference admin controllers.
 */
export const AUDIT_ACTIONS = {
  // Generic model lifecycle (Auditable trait parity)
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  // Settings
  SETTINGS_UPDATED: 'settings.updated',
  PUBLIC_TICKETS_UPDATED: 'settings.public_tickets_updated',
  // Users / roles
  USER_ROLE_UPDATED: 'user.role_updated',
  // Webhooks
  WEBHOOK_CREATED: 'webhook.created',
  WEBHOOK_UPDATED: 'webhook.updated',
  WEBHOOK_DELETED: 'webhook.deleted',
  // API tokens (security-sensitive: token create / revoke)
  API_TOKEN_CREATED: 'api_token.created',
  API_TOKEN_UPDATED: 'api_token.updated',
  API_TOKEN_REVOKED: 'api_token.revoked',
  // Automations
  AUTOMATION_CREATED: 'automation.created',
  AUTOMATION_UPDATED: 'automation.updated',
  AUTOMATION_DELETED: 'automation.deleted',
  // Two-factor authentication (security-sensitive)
  TWO_FACTOR_ENABLED: 'two_factor.enabled',
  TWO_FACTOR_DISABLED: 'two_factor.disabled',
  TWO_FACTOR_RECOVERY_CODES_REGENERATED: 'two_factor.recovery_codes_regenerated',
} as const

export type AuditActionName = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | (string & {})

/** Attribute keys never worth diffing into an audit row. */
export const DEFAULT_AUDIT_EXCLUDE = ['created_at', 'updated_at', 'createdAt', 'updatedAt']

/** Context accepted by the audit seam before it is normalized for persistence. */
export interface AuditContext {
  /** Actor id (host user). `null`/absent for anonymous or system actions. */
  userId?: UserId | null
  action: AuditActionName
  /** Logical target type (model name or a domain label like `settings`). */
  auditableType?: string | null
  /** Target key. Stringified on the way in so int/uuid/string keys round-trip. */
  auditableId?: UserId | null
  oldValues?: Record<string, any> | null
  newValues?: Record<string, any> | null
  ipAddress?: string | null
  userAgent?: string | null
}

/** The exact column payload persisted to `escalated_audit_logs`. */
export interface AuditEntry {
  userId: UserId | null
  action: string
  auditableType: string | null
  auditableId: string | null
  oldValues: Record<string, any> | null
  newValues: Record<string, any> | null
  ipAddress: string | null
  userAgent: string | null
}

/** Collapse an empty map to `null` so blank old/new columns stay null. */
function emptyToNull(values?: Record<string, any> | null): Record<string, any> | null {
  if (!values) return null
  return Object.keys(values).length > 0 ? values : null
}

/**
 * Normalize an audit context into the persisted row shape. Mirrors the Laravel
 * `Auditable::logAudit` payload: empty old/new maps collapse to null and the
 * auditable id is stringified so int/uuid/string host keys all round-trip.
 */
export function buildAuditEntry(context: AuditContext): AuditEntry {
  const rawId = context.auditableId
  return {
    userId: context.userId ?? null,
    action: context.action,
    auditableType: context.auditableType ?? null,
    auditableId: rawId === undefined || rawId === null ? null : String(rawId),
    oldValues: emptyToNull(context.oldValues),
    newValues: emptyToNull(context.newValues),
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  }
}

/**
 * Compute the old/new value maps for an "updated" audit from a model's original
 * attributes and the set of changed (dirty) attributes, dropping excluded and
 * unchanged keys. Mirrors the diff loop in the Laravel `Auditable` trait.
 */
export function diffAuditable(
  original: Record<string, any>,
  changed: Record<string, any>,
  exclude: string[] = DEFAULT_AUDIT_EXCLUDE
): { oldValues: Record<string, any> | null; newValues: Record<string, any> | null } {
  const oldValues: Record<string, any> = {}
  const newValues: Record<string, any> = {}
  const skip = new Set(exclude)

  for (const [key, value] of Object.entries(changed)) {
    if (skip.has(key)) continue
    if (original[key] === value) continue
    oldValues[key] = original[key] ?? null
    newValues[key] = value
  }

  return { oldValues: emptyToNull(oldValues), newValues: emptyToNull(newValues) }
}

/** Filters accepted by the admin audit-log list, mirroring the controller. */
export interface AuditLogFilters {
  userId?: UserId | null
  action?: string | null
  auditableType?: string | null
  dateFrom?: string | null
  dateTo?: string | null
}

/** Minimal row shape the list filter / sort helpers operate on. */
export interface AuditLogRow {
  userId?: UserId | null
  action?: string | null
  auditableType?: string | null
  createdAt?: string | Date | { toMillis?: () => number } | null
}

/** Resolve an absolute (UTC) millisecond value from any supported timestamp. */
function toMillis(value: AuditLogRow['createdAt']): number {
  if (!value) return 0
  if (typeof value === 'string') return new Date(value).getTime()
  if (value instanceof Date) return value.getTime()
  if (typeof (value as any).toMillis === 'function') return (value as any).toMillis()
  return 0
}

/**
 * Apply the admin list filters to a set of rows. Pure re-implementation of the
 * query the controller builds, so the filter semantics are unit-testable
 * without a database (matching this repo's controller-logic test convention).
 *
 * Date bounds are normalized to UTC day edges — `dateTo` is inclusive of the
 * whole day, mirroring the Laravel `<= $dateTo.' 23:59:59'`.
 */
export function filterAuditLogs<T extends AuditLogRow>(rows: T[], filters: AuditLogFilters): T[] {
  const { userId, action, auditableType, dateFrom, dateTo } = filters

  const from = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).getTime() : null
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999Z`).getTime() : null

  return rows.filter((row) => {
    if (userId !== undefined && userId !== null && userId !== '') {
      if (String(row.userId ?? '') !== String(userId)) return false
    }
    if (action && row.action !== action) return false
    if (auditableType && row.auditableType !== auditableType) return false

    if (from !== null || to !== null) {
      const at = toMillis(row.createdAt)
      if (from !== null && at < from) return false
      if (to !== null && at > to) return false
    }
    return true
  })
}

/** Order rows newest-first, matching `orderByDesc('created_at')`. */
export function sortAuditLogsDesc<T extends AuditLogRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
}
