/*
|--------------------------------------------------------------------------
| Typed auth.user accessors
|--------------------------------------------------------------------------
|
| `HttpContext['auth'].user` is typed as `never` when the package is built
| standalone, because AdonisJS's `Authenticators` interface is empty until
| the host app's auth config augments it. We can't ship our own
| `Authenticators` augmentation without conflicting with whatever guard
| the host configures.
|
| So instead, controllers/services that need the user go through these
| helpers, which assert the minimum shape the package actually relies on
| (`{ id, constructor }`). Hosts whose user has more fields satisfy this
| contract trivially; hosts whose user model lacks `id` would be a misuse
| we'd surface at runtime.
|
*/

import type { HttpContext } from '@adonisjs/core/http'

/**
 * Minimum shape the package needs from the host's authenticated user.
 *
 * - `id`: used as a foreign key on causer/assigner/etc. associations.
 *   The escalated schema uses numeric primary keys, so `id` must be a
 *   `number` here even though some hosts use string ids elsewhere — they
 *   should expose a numeric `id` on the user model for compatibility.
 * - `constructor.name`: used to populate the polymorphic `causer_type`
 *   column on `escalated_ticket_activities` and similar audit rows.
 */
export interface EscalatedAuthUser {
  id: number
  constructor: { name: string }
}

type AuthLike = HttpContext['auth'] | { user?: unknown }

/**
 * The signed-in user does not have what Escalated needs from it. Thrown where
 * the user is resolved for staff actions, instead of the raw TypeError or
 * database error the first write would otherwise end in.
 */
export class EscalatedUserContractError extends Error {
  status = 500
  code = 'E_ESCALATED_USER_CONTRACT'

  constructor(user: unknown) {
    const type =
      user && typeof user === 'object'
        ? ((user as any).constructor?.name ?? 'Object')
        : user === null
          ? 'null'
          : typeof user
    super(
      `Escalated: the signed-in user (${type}) does not implement EscalatedAuthUser ` +
        '(@escalated-dev/escalated-adonis/support/auth_user). Escalated needs an `id` ' +
        '(a number, or a string for UUID users with ESCALATED_USER_KEY_TYPE=uuid|string) and a ' +
        'model class, and stores `constructor.name` as the user type. Point config.userModel at ' +
        'your Lucid user model (default "#models/user") and make sure `ctx.auth.user` is an ' +
        'instance of it. Run `node ace escalated:doctor` to check the setup.'
    )
    this.name = 'EscalatedUserContractError'
  }
}

/** Whether `user` has what EscalatedAuthUser needs: an object with a number or non-empty string `id`. */
export function implementsEscalatedAuthUser(user: unknown): user is EscalatedAuthUser {
  if (!user || typeof user !== 'object') return false
  const id = (user as { id?: unknown }).id
  if (typeof id === 'number') return Number.isFinite(id)
  if (typeof id === 'bigint') return true
  return typeof id === 'string' && id !== ''
}

/** Throws EscalatedUserContractError unless `user` implements EscalatedAuthUser. */
export function assertEscalatedAuthUser(user: unknown): asserts user is EscalatedAuthUser {
  if (!implementsEscalatedAuthUser(user)) {
    throw new EscalatedUserContractError(user)
  }
}

/**
 * Return the currently authenticated user, or `null` if anonymous.
 */
export function getAuthUser(auth: AuthLike): EscalatedAuthUser | null {
  const user = (auth as { user?: EscalatedAuthUser }).user
  return user ?? null
}

/**
 * Return the currently authenticated user, throwing if anonymous.
 *
 * Use in admin/agent controllers that are mounted behind `auth` middleware
 * — the throw is just defense-in-depth; the middleware should already
 * have rejected the request.
 */
export function requireAuthUser(auth: AuthLike): EscalatedAuthUser {
  const user = getAuthUser(auth)
  if (!user) {
    throw new Error('Authentication required')
  }
  assertEscalatedAuthUser(user)
  return user
}
