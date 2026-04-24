import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Pure helpers for RFC 5322 Message-ID threading and signed Reply-To
 * addresses. Mirrors the NestJS reference
 * `escalated-nestjs/src/services/email/message-id.ts` and the Spring /
 * WordPress / .NET / Phoenix / Laravel / Rails / Django ports.
 *
 * ## Message-ID format
 *   <ticket-{ticketId}@{domain}>             initial ticket email
 *   <ticket-{ticketId}-reply-{replyId}@{domain}>  agent reply
 *
 * ## Signed Reply-To format
 *   reply+{ticketId}.{hmac8}@{domain}
 *
 * The signed Reply-To carries ticket identity even when clients strip
 * our Message-ID / In-Reply-To headers — the inbound provider webhook
 * verifies the 8-char HMAC-SHA256 prefix before routing a reply to its
 * ticket.
 */

/**
 * Build an RFC 5322 Message-ID. Pass `null` for `replyId` on the
 * initial ticket email; the `-reply-{id}` tail is appended only when
 * `replyId` is non-null.
 */
export function buildMessageId(
  ticketId: number,
  replyId: number | null | undefined,
  domain: string
): string {
  const body =
    typeof replyId === 'number' && Number.isFinite(replyId)
      ? `ticket-${ticketId}-reply-${replyId}`
      : `ticket-${ticketId}`
  return `<${body}@${domain}>`
}

/**
 * Extract the ticket id from a Message-ID we issued. Accepts the
 * header value with or without angle brackets. Returns `null` when
 * the input doesn't match our shape.
 */
export function parseTicketIdFromMessageId(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.match(/ticket-(\d+)(?:-reply-\d+)?@/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/**
 * Build a signed Reply-To address.
 */
export function buildReplyTo(ticketId: number, secret: string, domain: string): string {
  return `reply+${ticketId}.${sign(ticketId, secret)}@${domain}`
}

/**
 * Verify a reply-to address (full `local@domain` or just the local
 * part). Returns the ticket id on match, `null` otherwise. Uses
 * `crypto.timingSafeEqual` for timing-safe comparison.
 */
export function verifyReplyTo(address: string | null | undefined, secret: string): number | null {
  if (!address) return null
  const at = address.indexOf('@')
  const local = at > 0 ? address.slice(0, at) : address
  const match = local.match(/^reply\+(\d+)\.([a-f0-9]{8})$/i)
  if (!match) return null
  const ticketId = Number(match[1])
  if (!Number.isFinite(ticketId)) return null
  const expected = sign(ticketId, secret).toLowerCase()
  const provided = match[2].toLowerCase()
  if (expected.length !== provided.length) return null
  try {
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
      return ticketId
    }
  } catch {
    return null
  }
  return null
}

function sign(ticketId: number, secret: string): string {
  return createHmac('sha256', secret).update(String(ticketId)).digest('hex').slice(0, 8)
}
