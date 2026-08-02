import type { HttpContext } from '@adonisjs/core/http'
import AuditLog from '../models/audit_log.js'
import { getAuthUser } from '../support/auth_user.js'
import {
  buildAuditEntry,
  type AuditActionName,
  type AuditContext,
} from '../support/audit_events.js'
import type { UserId } from '../helpers/user_id_column.js'

/**
 * The reusable seam for the system-wide audit trail. Every admin / config /
 * security / user mutation that should be auditable calls this service instead
 * of writing an ad-hoc `AuditLog.create` — so the row shape stays consistent
 * and the actor / IP / user-agent are captured the same way everywhere.
 *
 * Mirrors how the Laravel `Auditable` trait centralizes `AuditLog::create`.
 * Writes never throw: a failed audit insert must not break the mutation that
 * triggered it (same "never throw" contract as `WebhookDispatcher`).
 */
export default class AuditService {
  /**
   * Persist an audit entry from an explicit context. Returns the created row,
   * or `null` if the write failed (already logged).
   */
  static async record(context: AuditContext): Promise<AuditLog | null> {
    try {
      const entry = buildAuditEntry(context)
      return await AuditLog.create(entry)
    } catch (error) {
      console.warn('[Escalated] audit record failed:', (error as Error).message)
      return null
    }
  }

  /**
   * Persist an audit entry for an HTTP-driven action, pulling the actor from
   * `auth.user` and the request context (IP + user agent) from the request.
   *
   * Accepts the minimal `{ auth, request }` slice of `HttpContext` so callers
   * that already destructure their context can pass just those two.
   */
  static async fromContext(
    ctx: Pick<HttpContext, 'auth' | 'request'>,
    action: AuditActionName,
    target: {
      auditableType?: string | null
      auditableId?: UserId | null
      oldValues?: Record<string, any> | null
      newValues?: Record<string, any> | null
    } = {}
  ): Promise<AuditLog | null> {
    const user = getAuthUser(ctx.auth)

    return this.record({
      userId: user?.id ?? null,
      action,
      auditableType: target.auditableType ?? null,
      auditableId: target.auditableId ?? null,
      oldValues: target.oldValues ?? null,
      newValues: target.newValues ?? null,
      ipAddress: ctx.request?.ip?.() ?? null,
      userAgent: ctx.request?.header?.('user-agent') ?? null,
    })
  }
}
