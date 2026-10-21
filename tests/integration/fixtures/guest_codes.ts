import { MemoryGuestRateLimitStore } from '../../../src/support/guest_rate_limit.js'

/*
|--------------------------------------------------------------------------
| Guest verification codes
|--------------------------------------------------------------------------
|
| The test application delivers guest verification codes here instead of by
| mail (`guestAccess.sendCode`), so a spec can read the code a guest would
| find in their inbox.
|
*/

export const sentCodes: Array<{ email: string; code: string; purpose: string }> = []

export function captureCode(email: string, code: string, purpose: string) {
  sentCodes.push({ email, code, purpose })
}

/** The latest code emailed to `email`. */
export function latestCode(email: string): string {
  const sent = sentCodes.filter((entry) => entry.email === email.trim().toLowerCase()).pop()
  if (!sent) throw new Error(`No verification code was sent to ${email}`)
  return sent.code
}

let proofs = 0

/**
 * Proof for `email` and `purpose`, as a guest holds it after reading the
 * email: `{verification_id, verification_code}`. Requested in-process, from a
 * client IP of its own and a budget store of its own, so specs never share a
 * budget.
 */
export async function guestProof(email: string, purpose: 'ticket' | 'chat' | 'lookup') {
  const { getConfig } = await import('../../../src/helpers/config.js')
  const { challenge } = await import('../../../src/support/guest_access.js')
  const config = getConfig() as any
  const previous = config.guestAccess?.store
  config.guestAccess = { ...config.guestAccess, store: new MemoryGuestRateLimitStore() }
  try {
    const id = await challenge(email, purpose, `proof-${++proofs}`)
    return { verification_id: id, verification_code: latestCode(email) }
  } finally {
    config.guestAccess.store = previous
  }
}

/**
 * `body` plus the proof the guest would send, for a request that needs one:
 * a widget ticket or the guest form (`ticket`), or a widget chat (`chat`).
 * Bodies that already carry proof, or have no usable email, are unchanged,
 * so specs about refusals still see them.
 */
export async function withGuestProof(method: string, path: string, body: any) {
  if (method.toUpperCase() !== 'POST' || !body || typeof body !== 'object') return body
  if ('verification_id' in body) return body
  const bare = path.split('?')[0].replace(/\/+$/, '')
  let purpose: 'ticket' | 'chat' | null = null
  let email: unknown
  if (bare.endsWith('/widget/chat/start')) {
    purpose = 'chat'
    email = body.email
  } else if (bare.endsWith('/widget/tickets')) {
    purpose = 'ticket'
    email = body.email
  } else if (bare.endsWith('/support/guest')) {
    purpose = 'ticket'
    email = body.guest_email ?? body.email
  }
  if (!purpose || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return body
  }
  return { ...body, ...(await guestProof(email, purpose)) }
}
