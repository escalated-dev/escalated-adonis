import type { HttpContext } from '@adonisjs/core/http'
import EscalatedSetting from '../models/escalated_setting.js'
import { getRenderer } from '../rendering/renderer.js'

const DKIM_STATUSES = ['verified', 'pending', 'failed', 'unknown']

/** A practical email check: one @, no spaces, a dot in the domain. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type EmailAddress = {
  email: string
  display_name: string
  department_id: number | null
  dkim_status: string
}

function present(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

/**
 * The support addresses of the email channel and the default reply address.
 * Mirrors escalated-laravel's `Admin\EmailSettingsController` and
 * `EmailChannelService`: two settings, `email_addresses` (a JSON list) and
 * `default_reply_address`. As there, they are stored for the admin to keep
 * track of; outbound mail does not read them, and DKIM is not checked.
 */
export default class AdminEmailSettingsController {
  async index(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Settings/EmailSettings', {
      addresses: await this.addresses(),
      defaultReplyAddress: (await EscalatedSetting.get('default_reply_address', '')) ?? '',
    })
  }

  async update({ request, response, session }: HttpContext) {
    const addresses = request.input('addresses')
    const reply = request.input('default_reply_address')
    const errors: Record<string, string> = {}

    if (!Array.isArray(addresses)) {
      errors.addresses = 'The addresses field is required.'
    } else {
      addresses.forEach((address: any, index: number) => {
        const at = `addresses.${index}`
        if (address === null || typeof address !== 'object') {
          errors[`${at}.email`] = 'The email field is required.'
          return
        }
        if (!present(address.email)) {
          errors[`${at}.email`] = 'The email field is required.'
        } else if (
          typeof address.email !== 'string' ||
          address.email.length > 255 ||
          !EMAIL.test(address.email)
        ) {
          errors[`${at}.email`] =
            'The email must be a valid email address of at most 255 characters.'
        }
        if (
          present(address.display_name) &&
          (typeof address.display_name !== 'string' || address.display_name.length > 255)
        ) {
          errors[`${at}.display_name`] = 'The display name may not be greater than 255 characters.'
        }
        if (present(address.department_id) && !/^\d+$/.test(String(address.department_id))) {
          errors[`${at}.department_id`] = 'The department id must be an integer.'
        }
        if (present(address.dkim_status) && !DKIM_STATUSES.includes(address.dkim_status)) {
          errors[`${at}.dkim_status`] =
            `The dkim status must be one of: ${DKIM_STATUSES.join(', ')}.`
        }
      })
    }

    if (present(reply) && (typeof reply !== 'string' || reply.length > 255 || !EMAIL.test(reply))) {
      errors.default_reply_address = 'The default reply address must be a valid email address.'
    }

    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    const normalised: EmailAddress[] = (addresses as any[]).map((address) => ({
      email: address.email,
      display_name: address.display_name ?? '',
      department_id: present(address.department_id) ? Number(address.department_id) : null,
      dkim_status: present(address.dkim_status) ? address.dkim_status : 'unknown',
    }))
    await EscalatedSetting.set('email_addresses', JSON.stringify(normalised))

    if (present(reply)) {
      await EscalatedSetting.set('default_reply_address', reply)
    }

    session.flash('success', 'Email settings updated.')
    return response.redirect().back()
  }

  protected async addresses(): Promise<EmailAddress[]> {
    const json = await EscalatedSetting.get('email_addresses', '[]')
    try {
      const parsed = JSON.parse(json ?? '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}
