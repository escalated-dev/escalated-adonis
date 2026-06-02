import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Permission from '../../models/permission.js'
import Role from '../../models/role.js'
import { getAuthUser } from '../../support/auth_user.js'
import type { UserId } from '../../helpers/user_id_column.js'

export type NewsletterPermission = 'newsletters.manage' | 'newsletters.send'

export default class NewsletterPermissionService {
  /** Returns false when the response was already sent (forbidden). */
  async require(ctx: HttpContext, permission: NewsletterPermission): Promise<boolean> {
    const user = getAuthUser(ctx.auth)
    if (!user) {
      ctx.response.forbidden({ error: 'Forbidden' })
      return false
    }

    const allowed = await this.userHasPermission((user as { id: UserId }).id, permission)
    if (!allowed) {
      ctx.response.forbidden({ error: 'Insufficient permissions' })
      return false
    }
    return true
  }

  async userHasPermission(userId: UserId, permission: NewsletterPermission): Promise<boolean> {
    const roleRows = await db.from('escalated_role_users').where('user_id', userId).select('role_id')
    if (roleRows.length === 0) return false

    const roleIds = roleRows.map((r) => r.role_id)
    const roles = await Role.query().whereIn('id', roleIds).preload('permissions')
    for (const role of roles) {
      if (role.slug === 'admin') return true
      if ((role.permissions ?? []).some((p) => p.slug === permission)) return true
    }
    return false
  }

  /** Wildcard-aware check used in tests. */
  async roleHasPermission(roleId: number, permission: NewsletterPermission): Promise<boolean> {
    const role = await Role.query().where('id', roleId).preload('permissions').first()
    if (!role) return false
    if (role.slug === 'admin') return true
    const slugs = new Set((role.permissions ?? []).map((p) => p.slug))
    if (slugs.has(permission)) return true
    const all = await Permission.all()
    const slugIndex = new Map(all.map((p) => [p.slug, p]))
    for (const slug of slugs) {
      if (slug.endsWith('.*')) {
        const prefix = slug.slice(0, -1)
        if (permission.startsWith(prefix)) return true
      }
      if (slug === '*') return true
    }
    void slugIndex
    return false
  }
}
