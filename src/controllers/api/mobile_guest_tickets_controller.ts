import type { HttpContext } from '@adonisjs/core/http'
import emitter from '@adonisjs/core/services/emitter'
import type Ticket from '../../models/ticket.js'
import Reply from '../../models/reply.js'
import Department from '../../models/department.js'
import EscalatedSetting from '../../models/escalated_setting.js'
import AttachmentService from '../../services/attachment_service.js'
import TicketService from '../../services/ticket_service.js'
import { ESCALATED_EVENTS } from '../../events/index.js'
import { getConfig } from '../../helpers/config.js'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../types.js'
import { signAttachments } from '../../support/attachment_access.js'
import { findHostUser } from '../../support/user_model.js'
import {
  InvalidCode,
  consume,
  isValidEmail,
  issue,
  normalizeEmail,
  privateResponse,
  resolve,
} from '../../support/guest_access.js'
import { validationError } from '../guest_verification_controller.js'

/*
|--------------------------------------------------------------------------
| Mobile guest tickets
|--------------------------------------------------------------------------
|
| `POST {mobile}/guest/tickets`, `GET {mobile}/guest/tickets/:token` and
| `POST {mobile}/guest/tickets/:token/replies`, where `{mobile}` is the REST
| API prefix plus `/mobile`. They reuse verified guest access
| (support/guest_access): the same codes and grants as the browser and widget
| guest routes. Contract:
| https://github.com/escalated-dev/escalated-developer-context/blob/main/domain-model/mobile-guest-api.md
|
*/

const PRIORITIES = ['low', 'medium', 'high', 'urgent', 'critical']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TEXT = 65535
const MAX_ATTACHMENTS = 10

export default class MobileGuestTicketsController {
  protected attachmentService = new AttachmentService()
  protected ticketService = new TicketService(this.attachmentService)

  /** Create a ticket with a `ticket` code: 201 `{data: <mobile ticket>, message}`. */
  async store(ctx: HttpContext) {
    const { request, response } = ctx
    privateResponse(response)
    if (!(await EscalatedSetting.guestTicketsEnabled())) {
      return response.forbidden({ message: 'Guest tickets are not enabled.' })
    }

    // Anything else (external_reference, metadata, status, assignee) is ignored.
    const data = request.only([
      'name',
      'email',
      'subject',
      'description',
      'priority',
      'department_id',
      'verification_id',
      'verification_code',
    ])
    const errors: Record<string, string> = {}
    requiredText(errors, data, 'name', 255)
    if (typeof data.email !== 'string' || !isValidEmail(data.email.trim())) {
      errors.email = 'The email field must be a valid email address.'
    }
    requiredText(errors, data, 'subject', 255)
    requiredText(errors, data, 'description', MAX_TEXT)
    if (typeof data.verification_id !== 'string' || !UUID.test(data.verification_id)) {
      errors.verification_id = 'The verification id field must be a valid UUID.'
    }
    if (
      typeof data.verification_code !== 'string' ||
      data.verification_code.trim() === '' ||
      data.verification_code.length > 16
    ) {
      errors.verification_code = 'The verification code field is required.'
    }
    if (present(data.priority) && !PRIORITIES.includes(String(data.priority))) {
      errors.priority = 'The selected priority is invalid.'
    }
    let departmentId: number | null = null
    if (present(data.department_id)) {
      const id = Number(data.department_id)
      const department = Number.isInteger(id) && id > 0 ? await Department.find(id) : null
      if (department) departmentId = department.id
      else errors.department_id = 'The selected department id is invalid.'
    }
    const attachments = attachmentFiles(ctx, errors)
    if (Object.keys(errors).length > 0) return validationError(ctx, errors)

    const email = normalizeEmail(data.email)
    let created: { ticket: Ticket; token: string }
    try {
      created = await consume(
        data.verification_id,
        data.verification_code,
        email,
        'ticket',
        async () => {
          const ticket = await this.ticketService.createGuest({
            name: data.name.trim(),
            email,
            subject: data.subject.trim(),
            description: data.description,
            priority: present(data.priority) ? String(data.priority) : null,
            channel: 'web',
            departmentId,
            attachments,
            verified: true,
          })
          return { ticket, token: await issue(ticket) }
        }
      )
    } catch (error) {
      if (error instanceof InvalidCode) {
        return validationError(ctx, { verification_code: error.message })
      }
      throw error
    }

    await created.ticket.load('department')
    return response.created({
      data: await mobileTicket(created.ticket, created.token, []),
      message: 'Ticket created.',
    })
  }

  /** The ticket a grant opens, with its public replies newest first. */
  async show(ctx: HttpContext) {
    privateResponse(ctx.response)
    const ticket = await resolve(ctx.params.token)
    if (!ticket) return ctx.response.notFound({ message: 'Not found.' })

    await ticket.load('department')
    const replies = await Reply.query()
      .where('ticket_id', ticket.id)
      .where('is_internal_note', false)
      .whereNull('deleted_at')
      .preload('attachments')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
    // Short-lived links bound to this grant (docs/private-attachments.md).
    await signAttachments(replies, { guestTicket: ticket })

    return ctx.response.json({ data: await mobileTicket(ticket, ctx.params.token, replies) })
  }

  /** A public guest reply: 201 `{message: 'Reply sent.'}`. */
  async reply(ctx: HttpContext) {
    const { request, response } = ctx
    privateResponse(response)
    const ticket = await resolve(ctx.params.token)
    if (!ticket) return response.notFound({ message: 'Not found.' })

    if (ticket.status === 'closed') {
      return response.unprocessableEntity({ message: 'This ticket is closed.' })
    }

    const data = request.only(['body', 'email'])
    const errors: Record<string, string> = {}
    requiredText(errors, data, 'body', MAX_TEXT)
    if (typeof data.email !== 'string' || !isValidEmail(data.email.trim())) {
      errors.email = 'The email field must be a valid email address.'
    }
    const attachments = attachmentFiles(ctx, errors)
    if (Object.keys(errors).length > 0) return validationError(ctx, errors)

    // A second factor on top of the grant, not a substitute for it.
    if (normalizeEmail(data.email) !== normalizeEmail(ticket.guestEmail)) {
      return response.forbidden({ message: 'The provided email does not match this ticket.' })
    }

    const reply = await Reply.create({
      ticketId: ticket.id,
      authorType: null,
      authorId: null,
      body: data.body,
      isInternalNote: false,
      isPinned: false,
      type: 'reply',
    })
    if (attachments.length > 0) {
      await this.attachmentService.storeMany('Reply', reply.id, attachments)
    }
    await emitter.emit(ESCALATED_EVENTS.REPLY_CREATED, { reply })

    return response.created({ message: 'Reply sent.' })
  }
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function requiredText(
  errors: Record<string, string>,
  data: Record<string, any>,
  field: string,
  max: number
) {
  const value = data[field]
  const label = field.replace(/_/g, ' ')
  if (typeof value !== 'string' || value.trim() === '') {
    errors[field] = `The ${label} field is required.`
  } else if (value.length > max) {
    errors[field] = `The ${label} field must not be greater than ${max} characters.`
  }
}

/** Uploaded `attachments[]`: at most ten, each within `tickets.maxAttachmentSizeKb`. */
function attachmentFiles(ctx: HttpContext, errors: Record<string, string>): any[] {
  const files = (ctx.request.files('attachments') ?? []).filter(Boolean)
  if (files.length > MAX_ATTACHMENTS) {
    errors.attachments = `The attachments field must not have more than ${MAX_ATTACHMENTS} items.`
    return []
  }
  const maxKb = Number(getConfig().tickets?.maxAttachmentSizeKb ?? 10240)
  if (files.some((file: any) => Number(file.size ?? 0) > maxKb * 1024)) {
    errors.attachments = `Each attachment must not be greater than ${maxKb} kilobytes.`
  }
  return files
}

async function displayName(id: unknown): Promise<string | null> {
  if (id === null || id === undefined || id === '') return null
  try {
    const user = await findHostUser(id as any)
    const name = user?.name ?? user?.fullName
    return typeof name === 'string' && name !== '' ? name : null
  } catch {
    return null
  }
}

function iso(value: { toISO: () => string | null } | null | undefined): string | null {
  return value ? value.toISO() : null
}

/**
 * The allow-listed mobile ticket object. Never the serialized model: no
 * metadata, external reference, chat metadata, internal notes or staff ids
 * and emails.
 */
export async function mobileTicket(ticket: Ticket, token: string | null, replies: Reply[]) {
  const requester = {
    name: ticket.guestName || 'Guest',
    email: ticket.guestEmail ?? '',
  }
  const assignee = ticket.assignedTo
    ? { id: 0, name: (await displayName(ticket.assignedTo)) ?? 'Support', email: '' }
    : null

  const replyPayloads = []
  for (const reply of replies) {
    if (reply.isInternalNote) continue
    const fromGuest = reply.authorType === null || reply.authorType === 'Guest'
    replyPayloads.push({
      id: reply.id,
      body: reply.body,
      is_internal_note: false,
      is_pinned: Boolean(reply.isPinned),
      author: fromGuest
        ? { id: 0, ...requester }
        : { id: 0, name: (await displayName(reply.authorId)) ?? 'Support', email: '' },
      attachments: (reply.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        filename: attachment.originalFilename,
        mime_type: attachment.mimeType,
        size: attachment.size,
        url: attachment.$extras.downloadUrl ?? null,
      })),
      created_at: iso(reply.createdAt),
    })
  }

  const status = String(ticket.status)
  const priority = String(ticket.priority)
  return {
    id: ticket.id,
    reference: ticket.reference,
    guest_access_token: token,
    guest_access_expires_at: token ? iso(ticket.guestAccessExpiresAt) : null,
    subject: ticket.subject,
    description: ticket.description ?? '',
    status: {
      value: status,
      label:
        ticket.customStatus?.label ??
        (STATUS_LABELS as Record<string, string>)[status] ??
        humanize(status),
    },
    priority: {
      value: priority,
      label: (PRIORITY_LABELS as Record<string, string>)[priority] ?? humanize(priority),
    },
    channel: ticket.channel,
    metadata: {},
    requester,
    assignee,
    department: ticket.department
      ? { id: ticket.department.id, name: ticket.department.name }
      : null,
    tags: [],
    replies: replyPayloads,
    activities: [],
    sla: {
      first_response_due_at: iso(ticket.firstResponseDueAt),
      first_response_at: iso(ticket.firstResponseAt),
      first_response_breached: Boolean(ticket.slaFirstResponseBreached),
      resolution_due_at: iso(ticket.resolutionDueAt),
      resolution_breached: Boolean(ticket.slaResolutionBreached),
    },
    is_following: false,
    followers_count: 0,
    resolved_at: iso(ticket.resolvedAt),
    closed_at: iso(ticket.closedAt),
    created_at: iso(ticket.createdAt),
    updated_at: iso(ticket.updatedAt),
  }
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
