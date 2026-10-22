import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Role from '../models/role.js'
import Permission from '../models/permission.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'

/**
 * Admin CRUD for roles and the permissions they grant. Mirrors
 * escalated-laravel's `Admin\RoleController`: the same pages, props and
 * redirects.
 *
 * Roles are assigned to users through `escalated_role_users`; this screen
 * manages the roles themselves.
 */
export default class AdminRolesController {
  async index(ctx: HttpContext) {
    const roles = await Role.query().orderBy('id', 'asc')
    const counts = await db
      .from('escalated_role_users')
      .select('role_id')
      .count('* as total')
      .groupBy('role_id')
    const usersByRole = new Map(counts.map((row: any) => [Number(row.role_id), Number(row.total)]))

    return getRenderer().render(ctx, 'Escalated/Admin/Roles/Index', {
      roles: roles.map((role) => ({
        ...this.serializeRole(role),
        users_count: usersByRole.get(role.id) ?? 0,
      })),
    })
  }

  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Roles/Form', {
      permissions: await this.groupedPermissions(),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = this.validated(request.all())
    if (typeof data === 'string') {
      session.flash('error', data)
      return response.redirect().back()
    }

    const role = await Role.create({
      name: data.name,
      slug: await this.uniqueSlug(data.name),
      description: data.description,
      isSystem: false,
    })
    await role.related('permissions').sync(await this.existingPermissionIds(data.permissions))

    session.flash('success', 'Role created.')
    return redirectToRoute(response, 'escalated.admin.roles.index')
  }

  async edit(ctx: HttpContext) {
    const role = await Role.query()
      .where('id', ctx.params.id)
      .preload('permissions', (q) => q.orderBy('id', 'asc'))
      .firstOrFail()

    return getRenderer().render(ctx, 'Escalated/Admin/Roles/Form', {
      role: {
        ...this.serializeRole(role),
        permissions: role.permissions.map((permission) => this.serializePermission(permission)),
      },
      permissions: await this.groupedPermissions(),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const role = await Role.findOrFail(params.id)
    const data = this.validated(request.all())
    if (typeof data === 'string') {
      session.flash('error', data)
      return response.redirect().back()
    }

    role.merge({ name: data.name, description: data.description })
    await role.save()
    await role.related('permissions').sync(await this.existingPermissionIds(data.permissions))

    session.flash('success', 'Role updated.')
    return redirectToRoute(response, 'escalated.admin.roles.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const role = await Role.findOrFail(params.id)

    if (role.isSystem) {
      session.flash('error', 'System roles cannot be deleted.')
      return response.redirect().back()
    }

    await role.delete()

    session.flash('success', 'Role deleted.')
    return redirectToRoute(response, 'escalated.admin.roles.index')
  }

  // ---- Helpers ----

  protected serializeRole(role: Role) {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      is_system: Boolean(role.isSystem),
      created_at: role.createdAt?.toISO() ?? null,
      updated_at: role.updatedAt?.toISO() ?? null,
    }
  }

  protected serializePermission(permission: Permission) {
    return {
      id: permission.id,
      name: permission.name,
      slug: permission.slug,
      group: permission.group,
      description: permission.description,
    }
  }

  /** Every permission keyed by its group, as Laravel's `groupBy('group')`. */
  protected async groupedPermissions() {
    const permissions = await Permission.query().orderBy('id', 'asc')
    const grouped: Record<string, ReturnType<AdminRolesController['serializePermission']>[]> = {}
    for (const permission of permissions) {
      const key = permission.group ?? ''
      ;(grouped[key] ??= []).push(this.serializePermission(permission))
    }
    return grouped
  }

  /** The request's role fields, or the message to show when they are invalid. */
  protected validated(
    input: Record<string, any>
  ): { name: string; description: string | null; permissions: number[] } | string {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name) return 'The name field is required.'
    if (name.length > 255) return 'The name may not be longer than 255 characters.'

    const description =
      typeof input.description === 'string' && input.description.trim() !== ''
        ? input.description
        : null

    const raw = Array.isArray(input.permissions) ? input.permissions : []
    const permissions = raw.map((id: unknown) => Number(id)).filter((id) => Number.isInteger(id))

    return { name, description, permissions }
  }

  /** Only ids that exist, so a stale or forged id cannot break the pivot. */
  protected async existingPermissionIds(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return []
    const rows = await Permission.query().whereIn('id', ids).select('id')
    return rows.map((row) => row.id)
  }

  /** `slug` is unique; a second "Agent" becomes `agent-2`. */
  protected async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'role'

    let slug = base
    for (let suffix = 2; await Role.findBy('slug', slug); suffix += 1) {
      slug = `${base}-${suffix}`
    }
    return slug
  }
}
