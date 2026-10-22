import type { HttpContext } from '@adonisjs/core/http'
import EscalatedSetting from '../models/escalated_setting.js'
import { getRenderer } from '../rendering/renderer.js'
import {
  ATTACHMENT_RETENTION,
  AUDIT_LOG_RETENTION,
  TICKET_RETENTION,
  purgePreview,
  retentionSettings,
} from '../support/data_retention.js'

/** Laravel's `boolean` rule: true, false, 1, 0, "1", "0". */
function toBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === '1' || value === 'true') return true
  if (value === false || value === 0 || value === '0' || value === 'false') return false
  return undefined
}

/**
 * How long closed tickets, attachments and audit log entries are kept.
 * Mirrors escalated-laravel's `Admin\DataRetentionController`. The settings are
 * enforced by `node ace escalated:purge-expired`.
 */
export default class AdminDataRetentionController {
  async index(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Settings/DataRetention', {
      settings: await retentionSettings(),
      purgePreview: await purgePreview(),
    })
  }

  async update({ request, response, session }: HttpContext) {
    const data = request.all()
    const errors: Record<string, string> = {}

    const allowed: Array<[string, string[]]> = [
      ['retention_closed_tickets', TICKET_RETENTION],
      ['retention_attachments', ATTACHMENT_RETENTION],
      ['retention_audit_logs', AUDIT_LOG_RETENTION],
    ]
    for (const [key, values] of allowed) {
      if (typeof data[key] !== 'string' || !values.includes(data[key])) {
        errors[key] = `The ${key.replaceAll('_', ' ')} must be one of: ${values.join(', ')}.`
      }
    }

    const gdpr = toBoolean(data.retention_user_data_gdpr)
    if (gdpr === undefined) {
      errors.retention_user_data_gdpr = 'The retention user data gdpr field must be true or false.'
    }

    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    for (const [key] of allowed) await EscalatedSetting.set(key, data[key])
    await EscalatedSetting.set('retention_user_data_gdpr', gdpr ? '1' : '0')

    session.flash('success', 'Data retention settings updated.')
    return response.redirect().back()
  }
}
