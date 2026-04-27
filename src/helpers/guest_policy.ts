import EscalatedSetting from '../models/escalated_setting.js'
import { getConfig } from './config.js'

export interface GuestPolicyOverrides {
  requesterType: string | null
  requesterId: number | null
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
 *   - guest_user: route to a pre-created host-app user via
 *     `requesterType = config.userModel` + `requesterId =
 *     guest_policy_user_id`. Falls through to unassigned behavior if
 *     `guest_policy_user_id` is zero, missing, or non-numeric.
 *   - prompt_signup: same as unassigned today; signup-invite emission
 *     is a listener-level follow-up.
 *
 * Returning only the two fields (rather than mutating a whole attrs
 * object) keeps TypeScript literal-type inference intact at the call
 * site — the caller's `status: 'open'` stays typed as `TicketStatus`.
 */
export async function resolveGuestPolicy(): Promise<GuestPolicyOverrides> {
  const mode = (await EscalatedSetting.get('guest_policy_mode')) || 'unassigned'

  if (mode === 'guest_user') {
    const raw = (await EscalatedSetting.get('guest_policy_user_id')) || ''
    const userId = Number.parseInt(raw, 10)
    if (Number.isFinite(userId) && userId > 0) {
      return {
        requesterType: getConfig().userModel,
        requesterId: userId,
      }
    }
  }

  return { requesterType: null, requesterId: null }
}
