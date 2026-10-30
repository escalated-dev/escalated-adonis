import type { HttpContext } from '@adonisjs/core/http'
import AuditService from '../services/audit_service.js'
import { AUDIT_ACTIONS } from '../support/audit_events.js'
import { getRenderer } from '../rendering/renderer.js'
import { t } from '../support/i18n.js'
import { findHostUser, resolveUserModel } from '../support/user_model.js'
import Role from '../models/role.js'
import { escalatedDb } from '../helpers/config.js'
import { rolesPermissionsEnabled } from '../support/access_features.js'

/**
 * Surface enough of the host User table for an admin to grant or revoke
 * agent / admin access from the panel. Mirrors the pinned `is_admin` /
 * `is_agent` columns the install workflow tells hosts to add — hosts
 * using a different role implementation (Spatie-style packages, custom
 * pivots, etc.) should override this controller in their own routes.
 *
 * Adonis port of `escalated-laravel`'s `Admin\UserController`.
 */
export default class AdminUsersController {
  /**
   * GET /support/admin/users — List users with their admin/agent flags.
   *
   * Renders the shared Inertia page with a Laravel-paginator-shaped
   * payload so the Vue component (which is the same one used by the
   * Laravel reference plugin) can iterate `users.data` and render
   * `users.links` for page navigation.
   */
  async index(ctx: HttpContext) {
    const UserModel = await this.loadUserModel()

    const search = String(ctx.request.input('search', '') ?? '').trim()
    const page = Math.max(1, Number.parseInt(String(ctx.request.input('page', 1)), 10) || 1)
    const perPage = 20

    const query = UserModel.query()

    if (search) {
      const like = `%${search}%`
      query.where((sub: any) => {
        sub.where('email', 'like', like)
        if (this.userHasNameColumn(UserModel)) {
          sub.orWhere('name', 'like', like)
        }
      })
    }

    // is_admin DESC, is_agent DESC, id ASC — admins first, then agents.
    query.orderBy('is_admin', 'desc').orderBy('is_agent', 'desc').orderBy('id', 'asc')

    const paginator = await query.paginate(page, perPage)

    const mapped = paginator.all().map((user: any) => ({
      id: user.id,
      name: user.name ?? null,
      email: user.email,
      is_admin: Boolean(user.isAdmin ?? user.is_admin ?? false),
      is_agent: Boolean(user.isAgent ?? user.is_agent ?? false),
    }))

    const authUser = (ctx as any).auth?.user as { id?: number | string } | undefined

    const props: Record<string, unknown> = {
      users: this.toLaravelPaginatorShape(paginator, mapped, ctx, { search }),
      filters: { search },
      currentUserId: authUser?.id ?? null,
    }

    // Escalated roles, only while roles & permissions is enforced: each
    // user's role slugs, and the roles an admin can give them.
    if (rolesPermissionsEnabled()) {
      const roles = await Role.query().orderBy('name')
      const slugs = new Map(roles.map((role) => [role.id, role.slug]))
      const db = await escalatedDb()
      const assigned = mapped.length
        ? await db
            .from('escalated_role_users')
            .whereIn(
              'user_id',
              mapped.map((user: any) => user.id)
            )
            .select('user_id', 'role_id')
        : []
      for (const user of mapped as Array<Record<string, any>>) {
        user.roles = assigned
          .filter((row: any) => String(row.user_id) === String(user.id))
          .map((row: any) => slugs.get(row.role_id))
          .filter(Boolean)
          .sort()
      }
      props.roles = roles.map((role) => ({ id: role.id, name: role.name, slug: role.slug }))
    }

    return getRenderer().render(ctx, 'Escalated/Admin/Users/Index', props)
  }

  /**
   * PUT /support/admin/users/:user/roles — Replace a user's Escalated roles.
   *
   * Body: `{ role_ids: number[] }`. Registered only while roles & permissions
   * is on, and needs `role.manage`. You cannot take away your own role
   * management: nobody would be left able to undo it.
   */
  async updateRoles(ctx: HttpContext) {
    const { request, response, session, params } = ctx

    // Laravel's rules (`role_ids` present|array, each integer|exists), and
    // its answer to a failed form visit: back, with the errors by key.
    const raw = request.all().role_ids
    const invalid = (errors: Record<string, string>) => {
      session.flash('errors', errors)
      return response.redirect().back()
    }
    if (raw === undefined || raw === null) {
      return invalid({ role_ids: 'The role ids field must be present.' })
    }
    if (!Array.isArray(raw)) {
      return invalid({ role_ids: 'The role ids field must be an array.' })
    }
    const badType = raw.findIndex(
      (id: unknown) =>
        !(typeof id === 'number' && Number.isInteger(id)) &&
        !(typeof id === 'string' && /^-?\d+$/.test(id))
    )
    if (badType !== -1) {
      return invalid({
        [`role_ids.${badType}`]: `The role_ids.${badType} field must be an integer.`,
      })
    }
    const roleIds = [...new Set(raw.map((id: unknown) => Number(id)))]

    const roles = roleIds.length
      ? await Role.query().whereIn('id', roleIds).preload('permissions')
      : []
    const found = new Set(roles.map((role) => Number(role.id)))
    const unknown = raw.findIndex((id: unknown) => !found.has(Number(id)))
    if (unknown !== -1) {
      return invalid({ [`role_ids.${unknown}`]: `The selected role_ids.${unknown} is invalid.` })
    }

    const target = await findHostUser(params.user)
    if (!target) {
      return response.notFound({ error: 'Not Found' })
    }

    const authUser = (ctx as any).auth?.user as { id?: number | string } | undefined
    const keepsRoleManagement = roles.some((role) =>
      (role.permissions ?? []).some((permission) => permission.slug === 'role.manage')
    )
    if (authUser && String(authUser.id) === String(target.id) && !keepsRoleManagement) {
      session.flash('error', t('admin.cannot_remove_own_role_management'))
      return response.redirect().back()
    }

    const db = await escalatedDb()
    const before = await db
      .from('escalated_role_users')
      .where('user_id', target.id)
      .select('role_id')
    await db.transaction(async (trx: any) => {
      await trx.from('escalated_role_users').where('user_id', target.id).delete()
      for (const roleId of roleIds) {
        await trx.table('escalated_role_users').insert({ role_id: roleId, user_id: target.id })
      }
    })

    await AuditService.fromContext(ctx, AUDIT_ACTIONS.USER_ROLE_UPDATED, {
      auditableType: 'User',
      auditableId: target.id,
      oldValues: { role_ids: before.map((row: any) => row.role_id) },
      newValues: { role_ids: roleIds },
    })

    session.flash('success', t('admin.user_updated'))
    return response.redirect().back()
  }

  /**
   * PATCH /support/admin/users/:user/role — Grant/revoke admin or agent role.
   *
   * Body: `{ role: 'admin' | 'agent', value: boolean }`.
   *
   * Cross-flag semantics (mirrors the Laravel reference exactly):
   *   - `role=admin`, `value=true`  → also force `is_agent=true`
   *     (admins are agents by definition).
   *   - `role=admin`, `value=false` → just turn admin off; the demoted
   *     admin keeps their agent flag.
   *   - `role=agent`, `value=true`  → just turn agent on.
   *   - `role=agent`, `value=false` AND the target is currently admin →
   *     also force `is_admin=false`, otherwise the admin gate stays on
   *     with the agent gate off (confusing for the user).
   *
   * Safety: an authenticated admin cannot demote themselves (would lock
   * them out of the panel they're using). We redirect-back with an
   * `error` flash and skip the update entirely.
   */
  async updateRole(ctx: HttpContext) {
    const { request, response, session, params } = ctx

    const role = String(request.input('role', '')).trim()
    const valueRaw = request.input('value')
    const value = valueRaw === true || valueRaw === 'true' || valueRaw === 1 || valueRaw === '1'

    if (role !== 'admin' && role !== 'agent') {
      session.flash('error', 'Invalid role.')
      return response.redirect().back()
    }

    const UserModel = await this.loadUserModel()
    const target = await UserModel.findOrFail(params.user)

    const authUser = (ctx as any).auth?.user as { id?: number | string } | undefined

    // Don't let an admin demote themselves and lock themselves out.
    if (role === 'admin' && !value && authUser && String(authUser.id) === String(target.id)) {
      session.flash('error', t('admin.cannot_remove_own_admin'))
      return response.redirect().back()
    }

    const before = {
      is_admin: Boolean(target.isAdmin ?? target.is_admin ?? false),
      is_agent: Boolean(target.isAgent ?? target.is_agent ?? false),
    }

    if (role === 'admin') {
      target.isAdmin = value
      // Admins are agents; promoting to admin auto-enables agent.
      // Demoting from admin does NOT auto-revoke agent — an ex-admin
      // can still answer tickets unless explicitly demoted.
      if (value) {
        target.isAgent = true
      }
    } else {
      target.isAgent = value
      // Revoking agent from an admin leaves the admin gate on but the
      // agent gate off — confusing. Demote them fully.
      if (!value && (target.isAdmin ?? target.is_admin ?? false)) {
        target.isAdmin = false
      }
    }

    await target.save()

    await AuditService.fromContext(ctx, AUDIT_ACTIONS.USER_ROLE_UPDATED, {
      auditableType: 'User',
      auditableId: target.id,
      oldValues: before,
      newValues: {
        role,
        value,
        is_admin: Boolean(target.isAdmin ?? target.is_admin ?? false),
        is_agent: Boolean(target.isAgent ?? target.is_agent ?? false),
      },
    })

    session.flash('success', t('admin.user_updated'))
    return response.redirect().back()
  }

  // ─── helpers ─────────────────────────────────────────────────────

  /**
   * Lazy-resolve the host User model via `config.userModel` (the same
   * path other admin controllers, e.g. `admin_api_tokens_controller`,
   * import the user model from).
   */
  protected async loadUserModel(): Promise<any> {
    return resolveUserModel()
  }

  /**
   * Best-effort check that the model has a `name` column. Falls back to
   * `true` so search still works on hosts where introspection fails.
   */
  protected userHasNameColumn(UserModel: any): boolean {
    try {
      const columns = UserModel?.$columnsDefinitions
      if (columns && typeof columns.has === 'function') {
        return columns.has('name')
      }
    } catch {
      // ignore
    }
    return true
  }

  /**
   * Adonis Lucid paginators serialize as `{ meta, data }` whereas the
   * shared Vue page (and the Laravel reference plugin) expect Laravel's
   * `{ data, current_page, last_page, per_page, total, links }` shape —
   * including a `links` array of `{ url, label, active }` entries with
   * "« Previous", numbered pages, and "Next »" markers.
   *
   * We shim that here so the same Inertia component works against the
   * Adonis backend without changes.
   */
  protected toLaravelPaginatorShape(
    paginator: any,
    data: any[],
    ctx: HttpContext,
    extraQuery: Record<string, string | number | undefined>
  ): Record<string, any> {
    const currentPage: number = paginator.currentPage ?? 1
    const lastPage: number = paginator.lastPage ?? 1
    const perPage: number = paginator.perPage ?? data.length
    const total: number =
      paginator.total ??
      (typeof paginator.getTotal === 'function' ? paginator.getTotal() : data.length)

    const baseUrl = ctx.request.url(false)

    const buildUrl = (page: number | null): string | null => {
      if (page === null) return null
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(extraQuery)) {
        if (v !== undefined && v !== null && v !== '') {
          params.set(k, String(v))
        }
      }
      params.set('page', String(page))
      const qs = params.toString()
      return qs ? `${baseUrl}?${qs}` : baseUrl
    }

    const links: { url: string | null; label: string; active: boolean }[] = []

    // « Previous
    links.push({
      url: currentPage > 1 ? buildUrl(currentPage - 1) : null,
      label: '&laquo; Previous',
      active: false,
    })

    // numbered pages — match Laravel's behaviour of emitting one entry
    // per page (the Vue template hides the whole block when there are
    // <= 3 links, so a tiny single-page response correctly disappears).
    for (let p = 1; p <= lastPage; p++) {
      links.push({
        url: buildUrl(p),
        label: String(p),
        active: p === currentPage,
      })
    }

    // Next »
    links.push({
      url: currentPage < lastPage ? buildUrl(currentPage + 1) : null,
      label: 'Next &raquo;',
      active: false,
    })

    return {
      data,
      current_page: currentPage,
      last_page: lastPage,
      per_page: perPage,
      total,
      from: data.length > 0 ? (currentPage - 1) * perPage + 1 : null,
      to: data.length > 0 ? (currentPage - 1) * perPage + data.length : null,
      first_page_url: buildUrl(1),
      last_page_url: buildUrl(lastPage),
      next_page_url: currentPage < lastPage ? buildUrl(currentPage + 1) : null,
      prev_page_url: currentPage > 1 ? buildUrl(currentPage - 1) : null,
      path: baseUrl,
      links,
    }
  }
}
