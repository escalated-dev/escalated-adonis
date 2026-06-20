import type { HttpContext } from '@adonisjs/core/http'
import EscalatedSetting from '../models/escalated_setting.js'
import { getConfig } from '../helpers/config.js'
import { getRenderer } from '../rendering/renderer.js'
import NewsletterPermissionService from '../services/newsletter/newsletter_permission_service.js'
import { redirectToRoute } from '../support/routing.js'
import {
  assertEmail,
  NewsletterValidationError,
  optionalString,
  requiredBoolean,
  requiredInteger,
  requiredString,
} from '../support/newsletter_http.js'

const SETTING_KEYS = {
  default_from: 'string',
  default_reply_to: 'string',
  default_theme: 'string',
  rate_limit_per_minute: 'number',
  batch_size: 'number',
  tracking_enabled: 'boolean',
} as const

type SettingKey = keyof typeof SETTING_KEYS

export default class AdminNewsletterSettingsController {
  private readonly permissions = new NewsletterPermissionService()

  async show(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    const settings: Record<string, unknown> = {}
    for (const key of Object.keys(SETTING_KEYS) as SettingKey[]) {
      const row = await EscalatedSetting.findBy('key', `newsletter.${key}`)
      settings[key] = row?.value ?? this.configFallback(key)
      if (key === 'tracking_enabled') {
        settings[key] =
          row?.value !== null && row?.value !== undefined
            ? row.value === '1' || row.value === 'true'
            : this.configFallback(key)
      } else if (key === 'rate_limit_per_minute' || key === 'batch_size') {
        settings[key] = Number(settings[key])
      }
    }

    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Settings', {
      settings,
      themes: ['default', 'branded'],
    })
  }

  async update(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    try {
      const body = ctx.request.all()
      const data = {
        default_from: assertEmail(optionalString(body, 'default_from'), 'default_from'),
        default_reply_to: assertEmail(optionalString(body, 'default_reply_to'), 'default_reply_to'),
        default_theme: requiredString(body, 'default_theme', 64),
        rate_limit_per_minute: requiredInteger(body, 'rate_limit_per_minute', 1, 10000),
        batch_size: requiredInteger(body, 'batch_size', 1, 1000),
        tracking_enabled: requiredBoolean(body, 'tracking_enabled'),
      }

      for (const key of Object.keys(SETTING_KEYS) as SettingKey[]) {
        const value = data[key]
        const stored = typeof value === 'boolean' ? String(Number(value)) : String(value ?? '')
        await EscalatedSetting.updateOrCreate({ key: `newsletter.${key}` }, { value: stored })
      }

      redirectToRoute(ctx.response, 'escalated.admin.newsletters.settings.show')
    } catch (error) {
      if (error instanceof NewsletterValidationError) {
        ctx.session.flash('errors', error.errors)
        return ctx.response.redirect().back()
      }
      throw error
    }
  }

  private configFallback(key: SettingKey): unknown {
    const config = getConfig() as any
    const newsletters = config.newsletters ?? {}
    switch (key) {
      case 'default_from':
        return newsletters.defaultFrom ?? null
      case 'default_reply_to':
        return newsletters.defaultReplyTo ?? null
      case 'default_theme':
        return newsletters.defaultTheme ?? 'default'
      case 'rate_limit_per_minute':
        return newsletters.rateLimitPerMinute ?? 60
      case 'batch_size':
        return newsletters.batchSize ?? 50
      case 'tracking_enabled':
        return newsletters.trackingEnabled !== false
      default:
        return null
    }
  }
}
