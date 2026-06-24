import type { UserId } from '../helpers/user_id_column.js'

/**
 * Exclude the actor (a user is never notified of their own action) and
 * de-duplicate a list of follower user ids, preserving order.
 *
 * The package abstracts the host user table and cannot resolve follower
 * emails itself, so these ids ride along on the reply/status events for the
 * host app to fan a notification out to. See issue #94.
 */
export function followerRecipients(userIds: UserId[], excludeUserId?: UserId): UserId[] {
  const result: UserId[] = []
  const seen = new Set<UserId>()
  for (const userId of userIds) {
    if (userId === excludeUserId || seen.has(userId)) continue
    seen.add(userId)
    result.push(userId)
  }
  return result
}
