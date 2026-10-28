import type { HttpContext } from '@adonisjs/core/http'
import EscalatedSetting from '../models/escalated_setting.js'
import Ticket from '../models/ticket.js'
import {
  CODE_TTL_SECONDS,
  InvalidCode,
  InvalidEmail,
  PURPOSES,
  TooManyChallenges,
  challenge,
  consume,
  isValidEmail,
  issue,
  markVerified,
  normalizeEmail,
  privateResponse,
} from '../support/guest_access.js'

const MAX_LOOKUP_RESULTS = 20

/**
 * `POST verification` and `POST lookup` on the guest (`{prefix}/guest`) and
 * widget (`{prefix}/widget`) surfaces. See docs/guest-access.md.
 */
export default class GuestVerificationController {
  /** Email a code: 202 `{verification_id, expires_in, message}`. */
  async verification(ctx: HttpContext) {
    const { request, response } = ctx
    if (!(await surfaceEnabled(ctx))) return response.forbidden({ message: 'Not available.' })

    const email = text(request.input('email'))
    const purpose = text(request.input('purpose'))
    const errors: Record<string, string> = {}
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address.'
    if (!(PURPOSES as readonly string[]).includes(purpose)) {
      errors.purpose = 'The selected purpose is invalid.'
    }
    if (Object.keys(errors).length > 0) return validationError(ctx, errors)
    if (purpose !== 'chat' && !(await EscalatedSetting.guestTicketsEnabled())) {
      return response.forbidden({ message: 'Not available.' })
    }

    let verificationId: string
    try {
      verificationId = await challenge(email, purpose, request.ip())
    } catch (error) {
      if (error instanceof InvalidEmail) return validationError(ctx, { email: error.message })
      if (error instanceof TooManyChallenges) {
        response.header('Retry-After', String(error.retryAfter))
        return response.tooManyRequests({ message: error.message })
      }
      console.warn(
        '[Escalated] could not send a guest verification code:',
        (error as Error).message
      )
      return response
        .status(503)
        .json({ message: 'Could not send a verification code. Try again later.' })
    }

    privateResponse(response)
    return response.status(202).json({
      verification_id: verificationId,
      expires_in: CODE_TTL_SECONDS,
      message: 'Check your email for a verification code.',
    })
  }

  /**
   * Find the caller's tickets by reference and proven email:
   * `{data: [{reference, subject, guest_access_token, expires_at}]}`. Each
   * match gets a fresh grant, which revokes its earlier ones.
   */
  async lookup(ctx: HttpContext) {
    const { request, response } = ctx
    if (!(await surfaceEnabled(ctx)) || !(await EscalatedSetting.guestTicketsEnabled())) {
      return response.forbidden({ message: 'Not available.' })
    }

    const email = text(request.input('email'))
    const reference = text(request.input('reference'))
    const errors: Record<string, string> = {}
    if (!email || email.length > 255) errors.email = 'Enter a valid email address.'
    if (!reference || reference.length > 255) errors.reference = 'The reference field is required.'
    Object.assign(errors, proofErrors(request.all()))
    if (Object.keys(errors).length > 0) return validationError(ctx, errors)

    const find = async () => {
      const tickets = await Ticket.query()
        .where('reference', reference)
        .whereNotNull('guest_email')
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc')
        .limit(MAX_LOOKUP_RESULTS)
      const matches = []
      for (const ticket of tickets) {
        // Exact address match, case-insensitively, on every database.
        if (normalizeEmail(ticket.guestEmail) !== normalizeEmail(email)) continue
        await markVerified(ticket, email)
        const token = await issue(ticket)
        matches.push({
          reference: ticket.reference,
          subject: ticket.subject,
          guest_access_token: token,
          expires_at: ticket.guestAccessExpiresAt!.toISO(),
        })
      }
      return matches
    }

    let matches: Awaited<ReturnType<typeof find>>
    try {
      matches = await consume(
        request.input('verification_id'),
        request.input('verification_code'),
        email,
        'lookup',
        find
      )
    } catch (error) {
      if (error instanceof InvalidCode) {
        return validationError(ctx, { verification_code: error.message })
      }
      throw error
    }

    privateResponse(response)
    return response.json({ data: matches })
  }
}

/** The widget surface follows the widget switch; the browser surface is always on. */
async function surfaceEnabled(ctx: HttpContext): Promise<boolean> {
  const name = ctx.route?.name ?? ''
  if (name.startsWith('escalated.widget.')) {
    return EscalatedSetting.getBool('widget_enabled', true)
  }
  return true
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Validation errors for the proof fields of a create/start/lookup body. */
export function proofErrors(body: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {}
  const id = body.verification_id
  const code = body.verification_code
  if (typeof id !== 'string' || id.trim() === '') {
    errors.verification_id = 'The verification id field is required.'
  }
  if (typeof code !== 'string' || code.trim() === '') {
    errors.verification_code = 'The verification code field is required.'
  } else if (code.length > 16) {
    errors.verification_code = 'The verification code is invalid.'
  }
  return errors
}

/** 422 in Laravel's validation shape: `{message, errors: {field: [message]}}`. */
export function validationError(ctx: HttpContext, errors: Record<string, string>) {
  const list = Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, [value]]))
  return ctx.response.unprocessableEntity({ message: Object.values(errors)[0], errors: list })
}
