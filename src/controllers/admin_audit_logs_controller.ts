import type { HttpContext } from '@adonisjs/core/http'
import AuditLog from '../models/audit_log.js'
import { getRenderer } from '../rendering/renderer.js'
import { laravelPaginatorShape } from '../support/pagination.js'
import { AUDIT_ACTIONS } from '../support/audit_events.js'

/**
 * Read-only admin surface for the system-wide audit trail: a filtered,
 * paginated list of recorded admin / config / security / user actions.
 *
 * Ports the Laravel `Admin\AuditLogController` — same filters (`user_id`,
 * `action`, `auditable_type`, `date_from`, `date_to`), newest-first ordering,
 * and dropdown data (users, action names, distinct resource types).
 */
export default class AdminAuditLogsController {
  /** Page size for the audit list (mirrors the Laravel `paginate(50)`). */
  protected perPage = 50

  /**
   * GET /support/admin/audit-logs — filtered, paginated audit list.
   */
  async index(ctx: HttpContext) {
    const { request } = ctx

    const filters = {
      user_id: String(request.input('user_id', '') ?? '').trim(),
      action: String(request.input('action', '') ?? '').trim(),
      auditable_type: String(request.input('auditable_type', '') ?? '').trim(),
      date_from: String(request.input('date_from', '') ?? '').trim(),
      date_to: String(request.input('date_to', '') ?? '').trim(),
    }

    const page = Math.max(1, Number.parseInt(String(request.input('page', 1)), 10) || 1)

    const query = AuditLog.query().orderBy('created_at', 'desc')

    if (filters.user_id) {
      query.where('user_id', filters.user_id)
    }
    if (filters.action) {
      query.where('action', filters.action)
    }
    if (filters.auditable_type) {
      query.where('auditable_type', filters.auditable_type)
    }
    if (filters.date_from) {
      query.where('created_at', '>=', filters.date_from)
    }
    if (filters.date_to) {
      query.where('created_at', '<=', `${filters.date_to} 23:59:59`)
    }

    const paginator = await query.paginate(page, this.perPage)

    const actorNames = await this.resolveActorNames(paginator.all().map((row) => row.userId))

    const data = paginator.all().map((row) => ({
      id: row.id,
      user_id: row.userId ?? null,
      user: row.userId !== null ? (actorNames.get(String(row.userId)) ?? null) : null,
      action: row.action,
      auditable_type: row.auditableType,
      auditable_id: row.auditableId,
      old_values: row.oldValues,
      new_values: row.newValues,
      ip_address: row.ipAddress,
      user_agent: row.userAgent,
      created_at: row.createdAt?.toISO() ?? null,
    }))

    const logs = laravelPaginatorShape(paginator, data, ctx.request.url(false), filters)

    return getRenderer().render(ctx, 'Escalated/Admin/AuditLog/Index', {
      logs,
      filters,
      users: await this.listActorOptions(),
      actions: Object.values(AUDIT_ACTIONS),
      resourceTypes: await this.distinctResourceTypes(),
    })
  }

  // ─── helpers ─────────────────────────────────────────────────────

  /**
   * Resolve a `userId -> { id, name, email }` map for the actors on this page.
   * Best-effort: hosts whose user model can't be loaded get null actor names.
   */
  protected async resolveActorNames(
    userIds: Array<string | number | null>
  ): Promise<Map<string, { id: number | string; name: string | null; email: string | null }>> {
    const map = new Map<
      string,
      { id: number | string; name: string | null; email: string | null }
    >()
    const ids = [...new Set(userIds.filter((id): id is string | number => id !== null).map(String))]
    if (ids.length === 0) return map

    try {
      const UserModel = await this.loadUserModel()
      const users = await UserModel.query().whereIn('id', ids)
      for (const user of users) {
        map.set(String(user.id), {
          id: user.id,
          name: user.name ?? user.fullName ?? null,
          email: user.email ?? null,
        })
      }
    } catch {
      // Host user model unavailable — leave actor names unresolved.
    }
    return map
  }

  /**
   * The actor dropdown options for the filter bar. Mirrors the Laravel
   * `$userModel::select('id', 'name')->orderBy('name')->get()`.
   */
  protected async listActorOptions(): Promise<Array<{ id: number | string; name: string | null }>> {
    try {
      const UserModel = await this.loadUserModel()
      const users = await UserModel.all()
      return users
        .map((user: any) => ({
          id: user.id,
          name: user.name ?? user.fullName ?? user.email ?? null,
        }))
        .sort((a: any, b: any) => String(a.name ?? '').localeCompare(String(b.name ?? '')))
    } catch {
      return []
    }
  }

  /** Distinct `auditable_type` values present in the log (filter dropdown). */
  protected async distinctResourceTypes(): Promise<string[]> {
    const rows = await AuditLog.query()
      .distinct('auditable_type')
      .whereNotNull('auditable_type')
      .orderBy('auditable_type', 'asc')
    return rows.map((row) => row.auditableType).filter((t): t is string => !!t)
  }

  /**
   * Lazy-resolve the host User model via `config.userModel` (same path the
   * other admin controllers import the user model from).
   */
  protected async loadUserModel(): Promise<any> {
    const config = (globalThis as any).__escalated_config
    const userModelPath = config?.userModel ?? '#models/user'
    const mod: any = await import(userModelPath)
    return mod.default
  }
}
