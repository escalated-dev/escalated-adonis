import type { HttpContext } from '@adonisjs/core/http'
import AuditService from '../services/audit_service.js'
import { AUDIT_ACTIONS } from '../support/audit_events.js'
import { getRenderer } from '../rendering/renderer.js'
import { t } from '../support/i18n.js'

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

    return getRenderer().render(ctx, 'Escalated/Admin/Users/Index', {
      users: this.toLaravelPaginatorShape(paginator, mapped, ctx, { search }),
      filters: { search },
      currentUserId: authUser?.id ?? null,
    })
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
    const config = (globalThis as any).__escalated_config
    const userModelPath = config?.userModel ?? '#models/user'
    const mod: any = await import(userModelPath)
    return mod.default
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
