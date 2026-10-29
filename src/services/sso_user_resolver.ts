import { randomBytes } from 'node:crypto'
import { escalatedDb } from '../helpers/config.js'
import { rolesPermissionsEnabled } from '../support/access_features.js'
import { ssoConfig, ssoCreateUsers, ssoSyncRoles, type SsoIdentity } from '../support/sso.js'
import { resolveUserModel } from '../support/user_model.js'
import { SsoValidationError } from './sso_service.js'

/**
 * Maps an SSO identity to a host user (ADR 2026-10-29-configurable-access-features):
 * match by email, case-insensitively; create one only when `sso.createUsers`
 * is on; and, with roles & permissions and `sso.syncRoles` both on, replace
 * the user's Escalated roles with the asserted role. SSO never touches the
 * host's admin or agent gates.
 */
export default class SsoUserResolver {
  async resolve(identity: SsoIdentity): Promise<any> {
    let user = await this.findByEmail(identity.email)

    if (!user) {
      if (!ssoCreateUsers()) {
        throw new SsoValidationError(
          `SSO refused: no user has the email ${identity.email} and sso.createUsers is off.`
        )
      }
      user = await this.create(identity)
    }

    await this.syncRole(user, identity.role)
    return user
  }

  protected async findByEmail(email: string): Promise<any> {
    const hook = ssoConfig().findUserByEmail
    if (hook) return (await hook(email)) ?? null

    const User = await resolveUserModel()
    if (typeof User.query !== 'function') {
      throw new Error(
        'Escalated SSO: the user model has no query(); set sso.findUserByEmail in config/escalated.ts.'
      )
    }
    return (await User.query().whereRaw('LOWER(email) = ?', [email.toLowerCase()]).first()) ?? null
  }

  protected async create(identity: SsoIdentity): Promise<any> {
    const hook = ssoConfig().createUser
    if (hook) return hook(identity)

    const User = await resolveUserModel()
    const name = identity.name || identity.email.split('@')[0]
    const values: Record<string, unknown> = {
      email: identity.email,
      // Unusable: nobody knows it. The host's model hashes it on save.
      password: randomBytes(32).toString('hex'),
    }
    const columns = User.$columnsDefinitions
    if (columns && typeof columns.has === 'function') {
      if (columns.has('name')) values.name = name
      else if (columns.has('fullName')) values.fullName = name
    } else {
      values.name = name
    }
    return User.create(values)
  }

  protected async syncRole(user: any, slug: string): Promise<void> {
    if (!slug || !rolesPermissionsEnabled() || !ssoSyncRoles()) return

    const db = await escalatedDb()
    const role = await db.from('escalated_roles').where('slug', slug).first()
    if (!role) return

    await db.transaction(async (trx: any) => {
      await trx.from('escalated_role_users').where('user_id', user.id).delete()
      await trx.table('escalated_role_users').insert({ role_id: role.id, user_id: user.id })
    })
  }
}
