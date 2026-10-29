import type { HttpContext } from '@adonisjs/core/http'
import EscalatedSetting from '../models/escalated_setting.js'
import AuditService from '../services/audit_service.js'
import { AUDIT_ACTIONS } from '../support/audit_events.js'
import { getConfig } from '../helpers/config.js'
import { configuredRequired } from '../support/two_factor.js'
import { getRenderer } from '../rendering/renderer.js'
import { t } from '../support/i18n.js'
import { invalidOriginEntries, rememberWidgetOriginSetting } from '../support/widget_origins.js'
import { isMaskedSecret, maskSecret } from '../support/secret_mask.js'

export default class AdminSettingsController {
  async index(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Settings', {
      settings: await this.getSettings(),
    })
  }

  async update({ auth, request, response, session }: HttpContext) {
    const data = request.only([
      'guest_tickets_enabled',
      'allow_customer_close',
      'auto_close_resolved_after_days',
      'max_attachments_per_reply',
      'max_attachment_size_kb',
      'ticket_reference_prefix',
      'inbound_email_enabled',
      'inbound_email_adapter',
      'inbound_email_address',
      'mailgun_signing_key',
      'postmark_inbound_token',
      'ses_region',
      'ses_topic_arn',
      'imap_host',
      'imap_port',
      'imap_encryption',
      'imap_username',
      'imap_password',
      'imap_mailbox',
      'show_powered_by',
      'widget_enabled',
      'widget_allowed_origins',
      'two_factor_required',
    ])

    const sensitiveKeys = ['mailgun_signing_key', 'postmark_inbound_token', 'imap_password']
    const prefix = String(data.ticket_reference_prefix ?? '')

    if (data.ticket_reference_prefix !== undefined && !this.isValidTicketReferencePrefix(prefix)) {
      session.flash('error', 'Ticket reference prefix cannot contain hyphens.')
      return response.redirect().back()
    }

    if (data.widget_allowed_origins !== undefined && data.widget_allowed_origins !== null) {
      const invalid = invalidOriginEntries(String(data.widget_allowed_origins))
      if (invalid.length > 0) {
        session.flash(
          'error',
          `Sites that can embed the widget must be origins such as https://shop.example.com ` +
            `or https://*.example.com, without a path. Not valid: ${invalid.join(', ')}`
        )
        return response.redirect().back()
      }
      data.widget_allowed_origins = String(data.widget_allowed_origins).trim()
    }

    const changed: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields that contain masked placeholder
      if (sensitiveKeys.includes(key) && this.isMaskedValue(value as string)) {
        continue
      }

      const strValue = typeof value === 'boolean' ? (value ? '1' : '0') : String(value ?? '')
      await EscalatedSetting.set(key, strValue)
      // Record which keys changed; redact secret values from the audit trail.
      changed[key] = sensitiveKeys.includes(key) ? '[redacted]' : strValue
    }

    if ('widget_allowed_origins' in changed) {
      rememberWidgetOriginSetting(changed.widget_allowed_origins)
    }

    await AuditService.fromContext({ auth, request }, AUDIT_ACTIONS.SETTINGS_UPDATED, {
      auditableType: 'settings',
      newValues: changed,
    })

    session.flash('success', t('admin.settings_updated'))
    return response.redirect().back()
  }

  protected async getSettings(): Promise<Record<string, any>> {
    const config = getConfig()

    return {
      guest_tickets_enabled: await EscalatedSetting.getBool('guest_tickets_enabled', true),
      allow_customer_close: await EscalatedSetting.getBool('allow_customer_close', true),
      auto_close_resolved_after_days: await EscalatedSetting.getInt(
        'auto_close_resolved_after_days',
        7
      ),
      max_attachments_per_reply: await EscalatedSetting.getInt('max_attachments_per_reply', 5),
      max_attachment_size_kb: await EscalatedSetting.getInt('max_attachment_size_kb', 10240),
      ticket_reference_prefix: await EscalatedSetting.get('ticket_reference_prefix', 'ESC'),
      show_powered_by: await EscalatedSetting.getBool('show_powered_by', true),
      // Defaults on, as the widget routes read it, so existing installs keep their widget.
      widget_enabled: await EscalatedSetting.getBool('widget_enabled', true),
      widget_allowed_origins: (await EscalatedSetting.get('widget_allowed_origins', '')) ?? '',
      // Used while the two-factor switch is on; the saved value wins over config.
      two_factor_required: await EscalatedSetting.getBool(
        'two_factor_required',
        configuredRequired()
      ),
      inbound_email_enabled: await EscalatedSetting.getBool(
        'inbound_email_enabled',
        config.inboundEmail?.enabled ?? false
      ),
      inbound_email_adapter: await EscalatedSetting.get(
        'inbound_email_adapter',
        config.inboundEmail?.adapter ?? 'mailgun'
      ),
      inbound_email_address: await EscalatedSetting.get(
        'inbound_email_address',
        config.inboundEmail?.address ?? ''
      ),
      mailgun_signing_key: this.maskSecret(
        await EscalatedSetting.get(
          'mailgun_signing_key',
          config.inboundEmail?.mailgun?.signingKey ?? ''
        )
      ),
      postmark_inbound_token: this.maskSecret(
        await EscalatedSetting.get(
          'postmark_inbound_token',
          config.inboundEmail?.postmark?.token ?? ''
        )
      ),
      ses_region: await EscalatedSetting.get(
        'ses_region',
        config.inboundEmail?.ses?.region ?? 'us-east-1'
      ),
      ses_topic_arn: await EscalatedSetting.get(
        'ses_topic_arn',
        config.inboundEmail?.ses?.topicArn ?? ''
      ),
      imap_host: await EscalatedSetting.get('imap_host', config.inboundEmail?.imap?.host ?? ''),
      imap_port: await EscalatedSetting.getInt('imap_port', config.inboundEmail?.imap?.port ?? 993),
      imap_encryption: await EscalatedSetting.get(
        'imap_encryption',
        config.inboundEmail?.imap?.encryption ?? 'ssl'
      ),
      imap_username: await EscalatedSetting.get(
        'imap_username',
        config.inboundEmail?.imap?.username ?? ''
      ),
      imap_password: this.maskSecret(
        await EscalatedSetting.get('imap_password', config.inboundEmail?.imap?.password ?? '')
      ),
      imap_mailbox: await EscalatedSetting.get(
        'imap_mailbox',
        config.inboundEmail?.imap?.mailbox ?? 'INBOX'
      ),
    }
  }

  /**
   * Public-ticket guest policy settings page.
   *
   * Controls the identity assigned to tickets submitted via the public widget
   * or inbound email. Read at request time by the widget controller, so
   * admins can switch modes at runtime without a redeploy. Mirrors
   * escalated-laravel's `Admin\PublicTicketsSettingsController`.
   */
  async publicTickets(ctx: HttpContext) {
    const userIdRaw = await EscalatedSetting.get('guest_policy_user_id', '')

    return getRenderer().render(ctx, 'Escalated/Admin/Settings/PublicTickets', {
      settings: {
        guest_policy_mode: await EscalatedSetting.get('guest_policy_mode', 'unassigned'),
        guest_policy_user_id: userIdRaw ? userIdRaw : null,
        guest_policy_signup_url_template: await EscalatedSetting.get(
          'guest_policy_signup_url_template',
          ''
        ),
      },
    })
  }

  /**
   * POST (what the shared page sends) or PUT /admin/settings/public-tickets
   */
  async updatePublicTickets({ auth, request, response, session }: HttpContext) {
    const mode = request.input('guest_policy_mode')
    const userIdRaw = request.input('guest_policy_user_id')
    const template = request.input('guest_policy_signup_url_template')
    const errors: Record<string, string> = {}

    if (!['unassigned', 'guest_user', 'prompt_signup'].includes(mode)) {
      errors.guest_policy_mode =
        'The guest policy mode must be one of: unassigned, guest_user, prompt_signup.'
    }

    const hasUserId = userIdRaw !== undefined && userIdRaw !== null && userIdRaw !== ''
    if (hasUserId && !(/^\d+$/.test(String(userIdRaw)) && Number(userIdRaw) >= 1)) {
      errors.guest_policy_user_id = 'The guest user id must be a whole number of at least 1.'
    } else if (!hasUserId && mode === 'guest_user') {
      errors.guest_policy_user_id = 'The guest user id is required when the mode is guest_user.'
    }

    if (
      template !== undefined &&
      template !== null &&
      (typeof template !== 'string' || template.length > 500)
    ) {
      errors.guest_policy_signup_url_template =
        'The signup URL template may not be greater than 500 characters.'
    }

    if (Object.keys(errors).length > 0) {
      session.flash('errors', errors)
      return response.redirect().back()
    }

    await EscalatedSetting.set('guest_policy_mode', mode)
    await EscalatedSetting.set(
      'guest_policy_user_id',
      mode === 'guest_user' ? String(Number(userIdRaw)) : ''
    )
    await EscalatedSetting.set(
      'guest_policy_signup_url_template',
      mode === 'prompt_signup' ? String(template ?? '') : ''
    )

    await AuditService.fromContext({ auth, request }, AUDIT_ACTIONS.PUBLIC_TICKETS_UPDATED, {
      auditableType: 'settings',
      newValues: { guest_policy_mode: mode },
    })

    session.flash('success', 'Guest policy updated.')
    return response.redirect().back()
  }

  protected isMaskedValue(value: string | null): boolean {
    return isMaskedSecret(value)
  }

  protected isValidTicketReferencePrefix(value: string): boolean {
    return !value.includes('-')
  }

  /**
   * Mask a secret for display: shows whether it is set, and nothing of the
   * value itself.
   */
  protected maskSecret(value: string | null): string {
    return maskSecret(value)
  }
}
