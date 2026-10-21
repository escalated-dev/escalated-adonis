import type { HttpContext } from '@adonisjs/core/http'
import Attachment from '../models/attachment.js'
import ApiToken from '../models/api_token.js'
import {
  attachmentParent,
  contentDisposition,
  guestCredentialDigest,
  isStaff,
  readAttachmentToken,
  responseContentType,
  sameDigest,
} from '../support/attachment_access.js'
import { userCanAccessTicket } from '../support/ticket_access.js'

/**
 * GET {prefix}/attachments/:attachment/download
 *
 * The only way attachment bytes leave the package. The link must be current
 * (see `attachmentDownloadUrl`), and the person following it must still have
 * access to the ticket. Ports escalated-laravel's attachment download.
 */
export default class AttachmentsController {
  async download(ctx: HttpContext) {
    const { params, request, response } = ctx
    const id = Number(params.attachment)

    const payload = await readAttachmentToken(request.input('token'))
    if (!payload || payload.attachment !== id) {
      return response.forbidden({ message: 'This download link is invalid or has expired.' })
    }

    const attachment = await Attachment.find(id)
    if (!attachment) return response.notFound({ message: 'Attachment not found.' })

    const parent = await attachmentParent(attachment)
    if (!parent) return response.notFound({ message: 'Attachment not found.' })

    const allowed = await this.allowed(ctx, payload.guest, parent)
    if (allowed !== true) return allowed

    const { default: drive } = await import('@adonisjs/drive/services/main')
    const disk = drive.use(attachment.disk as any)
    if (!(await disk.exists(attachment.path))) {
      return response.notFound({ message: 'Attachment not found.' })
    }

    response.header('Content-Type', responseContentType(attachment.mimeType))
    response.header('Content-Disposition', contentDisposition(attachment.originalFilename))
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('Cache-Control', 'private, no-store, max-age=0')
    response.header('Referrer-Policy', 'no-referrer')
    return response.stream(await disk.getStream(attachment.path))
  }

  /** True when the caller may download; otherwise the refusal to send. */
  protected async allowed(
    ctx: HttpContext,
    guest: string | undefined,
    parent: NonNullable<Awaited<ReturnType<typeof attachmentParent>>>
  ) {
    const { response } = ctx

    // A guest link opens without a session while the guest's credential for
    // this ticket is unchanged, and never for an internal note.
    if (typeof guest === 'string') {
      const current = await guestCredentialDigest(parent.ticket)
      if (parent.isPublic && current && sameDigest(current, guest)) return true
    }

    const user = await this.user(ctx)
    if (user === 'invalid-bearer') {
      return response.unauthorized({ message: 'Invalid token.' })
    }
    if (!user || !(await userCanAccessTicket(user, parent.ticket))) {
      return response.forbidden({ message: 'You cannot download this attachment.' })
    }
    if (!parent.isPublic && !(await isStaff(user))) {
      return response.forbidden({ message: 'You cannot download this attachment.' })
    }
    return true
  }

  /**
   * The person asking: an API client by its Escalated bearer token, otherwise
   * the host session. A bearer that does not authenticate is refused outright;
   * it never falls back to the session.
   */
  protected async user(ctx: HttpContext): Promise<any | 'invalid-bearer' | null> {
    const header = ctx.request.header('Authorization') ?? ''
    if (header.startsWith('Bearer ')) {
      const token = await ApiToken.findByPlainText(header.substring(7))
      if (!token || token.isExpired()) return 'invalid-bearer'
      if (!token.hasAbility('agent') && !token.hasAbility('admin')) return 'invalid-bearer'
      const owner = await token.loadTokenable()
      if (!owner || !(await isStaff(owner))) return 'invalid-bearer'
      return owner
    }

    const auth = (ctx as any).auth
    if (!auth) return null
    if (!auth.user && typeof auth.check === 'function') {
      try {
        await auth.check()
      } catch {
        return null
      }
    }
    return auth.user ?? null
  }
}
