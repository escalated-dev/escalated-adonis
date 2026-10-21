import { createHash, timingSafeEqual } from 'node:crypto'
import { getConfig } from '../helpers/config.js'
import type Attachment from '../models/attachment.js'
import type Ticket from '../models/ticket.js'

/*
|--------------------------------------------------------------------------
| Private attachment access
|--------------------------------------------------------------------------
|
| Ports escalated-laravel's AttachmentAccess (docs/private-attachments.md).
| Attachments are never served by disk URL. Pages and API answers carry a
| short-lived, encrypted link to `{prefix}/attachments/:id/download`, and the
| download route checks current access to the ticket on every request:
|
| - agents and admins who can see the ticket get every attachment, internal
|   notes included;
| - the requester gets the ticket's and its public replies' attachments;
| - a guest gets a link only from the guest page, bound to the ticket's
|   current guest credential, and never for an internal note.
|
*/

/** The purpose the download token is encrypted for, so no other token decrypts as one. */
export const ATTACHMENT_TOKEN_PURPOSE = 'escalated-attachment'

/** Content types served as themselves. Everything else is application/octet-stream. */
export const INLINE_SAFE_TYPES = new Set([
  'application/pdf',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
])

export interface AttachmentTokenPayload {
  attachment: number
  /** Digest of the guest credential the link was issued under, for guest links only. */
  guest?: string
}

/** Link lifetime in minutes: `storage.downloadTtlMinutes`, default 10, clamped to 1..60. */
export function downloadTtlMinutes(): number {
  const raw = Number((getConfig() as any).storage?.downloadTtlMinutes ?? 10)
  if (!Number.isFinite(raw)) return 10
  return Math.max(1, Math.min(60, Math.floor(raw)))
}

/**
 * The digest a guest link carries: of the ticket's active grant (or, with
 * `guestAccess.legacyTokens`, its legacy token). Rotating, expiring or
 * revoking the grant changes it, which kills the links issued under it.
 */
export async function guestCredentialDigest(ticket: Ticket): Promise<string | null> {
  const { guestCredential } = await import('./guest_access.js')
  const credential = await guestCredential(ticket)
  if (!credential) return null
  return createHash('sha256').update(`escalated-attachment:${credential}`).digest('hex')
}

export function sameDigest(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function routePrefix(): string {
  const prefix = String(getConfig().routes?.prefix ?? 'support').replace(/^\/+|\/+$/g, '')
  return prefix ? `/${prefix}` : ''
}

/**
 * A short-lived download link for `attachment`.
 *
 * Pass `guestTicket` only from a guest entry point that has already
 * authenticated the guest's credential for that ticket: the link then opens
 * without a session while that credential stays current. The caller must
 * only do so for the ticket's own, public attachments; the download route
 * checks that again.
 */
export async function attachmentDownloadUrl(
  attachment: Pick<Attachment, 'id'>,
  options: { guestTicket?: Ticket } = {}
): Promise<string> {
  const { default: encryption } = await import('@adonisjs/core/services/encryption')
  const payload: AttachmentTokenPayload = { attachment: Number(attachment.id) }
  const guest = options.guestTicket ? await guestCredentialDigest(options.guestTicket) : null
  let seconds = downloadTtlMinutes() * 60
  if (guest) {
    payload.guest = guest
    // A guest link never outlives the grant it was issued under.
    const grantEnds = options.guestTicket?.guestAccessExpiresAt
    if (grantEnds) {
      seconds = Math.max(
        1,
        Math.min(seconds, Math.floor(grantEnds.toSeconds() - Date.now() / 1000))
      )
    }
  }
  const token = encryption.encrypt(payload, `${seconds}s`, ATTACHMENT_TOKEN_PURPOSE)
  return `${routePrefix()}/attachments/${attachment.id}/download?token=${encodeURIComponent(token)}`
}

/** Reads a download token; null when it is missing, tampered with or expired. */
export async function readAttachmentToken(token: unknown): Promise<AttachmentTokenPayload | null> {
  if (typeof token !== 'string' || token === '') return null
  const { default: encryption } = await import('@adonisjs/core/services/encryption')
  try {
    const payload = encryption.decrypt<AttachmentTokenPayload>(token, ATTACHMENT_TOKEN_PURPOSE)
    if (!payload || typeof payload !== 'object' || !Number.isInteger(payload.attachment)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

/**
 * The ticket an attachment belongs to, and whether customers may see it (a
 * ticket's own attachment or a public reply's). Null when the parent is gone.
 */
export async function attachmentParent(
  attachment: Pick<Attachment, 'attachableType' | 'attachableId'>
): Promise<{ ticket: Ticket; isPublic: boolean } | null> {
  const { default: TicketModel } = await import('../models/ticket.js')
  if (attachment.attachableType === 'Ticket') {
    const ticket = await TicketModel.find(attachment.attachableId)
    if (!ticket || ticket.deletedAt) return null
    return { ticket, isPublic: true }
  }
  if (attachment.attachableType === 'Reply') {
    const { default: Reply } = await import('../models/reply.js')
    const reply = await Reply.find(attachment.attachableId)
    if (!reply || reply.deletedAt) return null
    const ticket = await TicketModel.find(reply.ticketId)
    if (!ticket || ticket.deletedAt) return null
    return { ticket, isPublic: !reply.isInternalNote }
  }
  return null
}

/** Whether `user` is an agent or an admin. */
export async function isStaff(user: any): Promise<boolean> {
  if (!user) return false
  const authorization = getConfig().authorization
  if (authorization?.isAdmin && (await authorization.isAdmin(user))) return true
  return Boolean(authorization?.isAgent && (await authorization.isAgent(user)))
}

/**
 * Sign every attachment on the given tickets and replies, so they serialize
 * with a download `url`. Guest pages pass `guestTicket`.
 */
export async function signAttachments(
  owners: Array<{ attachments?: Attachment[] } | null | undefined>,
  options: { guestTicket?: Ticket } = {}
): Promise<void> {
  for (const owner of owners) {
    for (const attachment of owner?.attachments ?? []) {
      attachment.$extras.downloadUrl = await attachmentDownloadUrl(attachment, options)
    }
  }
}

/** A filename safe for a quoted Content-Disposition parameter. */
export function safeFilename(name: string | null | undefined): string {
  const last = String(name ?? '')
    .split(/[\\/]/)
    .pop()!
  // Control characters, quotes and the characters that break the header.
  const base = [...last]
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 0x1f && code !== 0x7f && char !== '"' && char !== '\\' && char !== ';'
    })
    .join('')
    .trim()
  return base || 'attachment'
}

/** The Content-Disposition value: an ASCII fallback plus the UTF-8 name. */
export function contentDisposition(name: string | null | undefined): string {
  const safe = safeFilename(name)
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`
}

/** The Content-Type to answer with: the stored type when it is safe, else octet-stream. */
export function responseContentType(mimeType: string | null | undefined): string {
  const type = String(mimeType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  return INLINE_SAFE_TYPES.has(type) ? type : 'application/octet-stream'
}
