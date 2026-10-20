import EscalatedSetting from '../models/escalated_setting.js'
import { findHostUser } from '../support/user_model.js'
import type { UserId } from './user_id_column.js'

export interface GuestPolicyOverrides {
  requesterType: string | null
  requesterId: UserId | null
  /** The host user the ticket is routed to, when the policy names one. */
  requester?: any
}

/**
 * Resolve the admin-configured guest policy into a
 * `{ requesterType, requesterId }` pair that the caller spreads onto
 * its ticket-create attrs. Persisted by AdminSettingsController under
 * three keys in EscalatedSetting (guest_policy_mode /
 * guest_policy_user_id / guest_policy_signup_url_template).
 *
 * Modes:
 *   - unassigned (default): both null.
 *   - guest_user: route to a pre-created host-app user. The configured key
 *     is looked up in the host's user model (`config.userModel`) as-is, so
 *     integer, string and UUID keys all work, and the ticket records the
 *     model's class name and the user's own id -- the same pair every other
 *     path stores (`user.constructor.name`, `user.id`), as Laravel's
 *     GuestTicketService::applyIdentityPolicy does with associate(). Falls
 *     through to unassigned when the key is empty or names no user.
 *   - prompt_signup: same as unassigned today; signup-invite emission
 *     is a listener-level follow-up.
 *
 * Returning only these fields (rather than mutating a whole attrs
 * object) keeps TypeScript literal-type inference intact at the call
 * site — the caller's `status: 'open'` stays typed as `TicketStatus`.
 */
export async function resolveGuestPolicy(): Promise<GuestPolicyOverrides> {
  const mode = (await EscalatedSetting.get('guest_policy_mode')) || 'unassigned'

  if (mode === 'guest_user') {
    const raw = String((await EscalatedSetting.get('guest_policy_user_id')) ?? '').trim()
    if (raw !== '') {
      let user: any = null
      try {
        user = await findHostUser(raw)
      } catch {
        user = null
      }
      if (user && user.id !== null && user.id !== undefined) {
        return {
          requesterType: user.constructor.name,
          requesterId: user.id,
          requester: user,
        }
      }
    }
  }

  return { requesterType: null, requesterId: null }
}
