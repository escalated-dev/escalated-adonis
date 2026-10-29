/*
|--------------------------------------------------------------------------
| Permissions
|--------------------------------------------------------------------------
|
| A user's Escalated permissions are the union of their roles' permissions
| (escalated_role_users + escalated_role_permissions). Nothing else grants
| one: not the host's admin gate, not an `is_admin` flag. A user who should
| have everything holds the `admin` role, which the seeder gives every
| permission.
|
| While roles & permissions is switched off the host gates decide everything,
| so `allows()` is always true and staff share `['*']` with the frontend.
|
*/

import { escalatedDb } from '../helpers/config.js'
import { rolesPermissionsEnabled } from './access_features.js'

type UserId = number | string

/** Every permission slug the user's roles grant (`[]` without a role). */
export async function userPermissions(userId: UserId | null | undefined): Promise<string[]> {
  if (userId === null || userId === undefined || userId === '') return []

  const db = await escalatedDb()
  const rows = await db
    .from('escalated_role_users as ru')
    .join('escalated_role_permissions as rp', 'rp.role_id', 'ru.role_id')
    .join('escalated_permissions as p', 'p.id', 'rp.permission_id')
    .where('ru.user_id', userId)
    .distinct('p.slug')

  return rows.map((row: { slug: string }) => row.slug).sort()
}

export async function userHasPermission(
  userId: UserId | null | undefined,
  slug: string
): Promise<boolean> {
  const granted = await userPermissions(userId)
  return granted.includes(slug)
}

/**
 * Whether the user may do what the permission covers. Always true while roles
 * & permissions is switched off: the caller has already passed the host gate,
 * and the gates alone decide.
 */
export async function allows(userId: UserId | null | undefined, slug: string): Promise<boolean> {
  return !rolesPermissionsEnabled() || (await userHasPermission(userId, slug))
}

/**
 * The `permissions` the shared frontend reads. With roles & permissions on,
 * the user's slugs; off, `['*']` for staff (the gates decide everything) and
 * `[]` for anyone else.
 */
export async function sharedPermissions(
  userId: UserId | null | undefined,
  isStaff: boolean
): Promise<string[]> {
  if (userId === null || userId === undefined) return []
  if (!rolesPermissionsEnabled()) return isStaff ? ['*'] : []
  return userPermissions(userId)
}
