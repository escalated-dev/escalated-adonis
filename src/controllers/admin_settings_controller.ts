import type { HttpContext } from '@adonisjs/core/http'
import EscalatedSetting from '../models/escalated_setting.js'
import { getConfig } from '../helpers/config.js'
import { t } from '../support/i18n.js'

export default class AdminSettingsController {
  async index({ inertia }: HttpContext) {
    return inertia.render('Escalated/Admin/Settings', {
      settings: await this.getSettings(),
    })
  }

  async update({ request, response, session }: HttpContext) {
    const data = request.only([
      'guest_tickets_enabled', 'allow_customer_close',
      'auto_close_resolved_after_days', 'max_attachments_per_reply',
      'max_attachment_size_kb', 'ticket_reference_prefix',
      'inbound_email_enabled', 'inbound_email_adapter', 'inbound_email_address',
      'mailgun_signing_key', 'postmark_inbound_token',
      'ses_region', 'ses_topic_arn',
      'imap_host', 'imap_port', 'imap_encryption',
      'imap_username', 'imap_password', 'imap_mailbox',
    ])

    const sensitiveKeys = ['mailgun_signing_key', 'postmark_inbound_token', 'imap_password']

    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive fields that contain masked placeholder
      if (sensitiveKeys.includes(key) && this.isMaskedValue(value as string)) {
        continue
      }

      const strValue = typeof value === 'boolean' ? (value ? '1' : '0') : String(value ?? '')
      await EscalatedSetting.set(key, strValue)
    }

    session.flash('success', t('admin.settings_updated'))
    return response.redirect().back()
  }

  protected async getSettings(): Promise<Record<string, any>> {
    const config = getConfig()

    return {
      guest_tickets_enabled: await EscalatedSetting.getBool('guest_tickets_enabled', true),
      allow_customer_close: await EscalatedSetting.getBool('allow_customer_close', true),
      auto_close_resolved_after_days: await EscalatedSetting.getInt('auto_close_resolved_after_days', 7),
      max_attachments_per_reply: await EscalatedSetting.getInt('max_attachments_per_reply', 5),
      max_attachment_size_kb: await EscalatedSetting.getInt('max_attachment_size_kb', 10240),
      ticket_reference_prefix: await EscalatedSetting.get('ticket_reference_prefix', 'ESC'),
      inbound_email_enabled: await EscalatedSetting.getBool('inbound_email_enabled', config.inboundEmail?.enabled ?? false),
      inbound_email_adapter: await EscalatedSetting.get('inbound_email_adapter', config.inboundEmail?.adapter ?? 'mailgun'),
      inbound_email_address: await EscalatedSetting.get('inbound_email_address', config.inboundEmail?.address ?? ''),
      mailgun_signing_key: this.maskSecret(await EscalatedSetting.get('mailgun_signing_key', config.inboundEmail?.mailgun?.signingKey ?? '')),
      postmark_inbound_token: this.maskSecret(await EscalatedSetting.get('postmark_inbound_token', config.inboundEmail?.postmark?.token ?? '')),
      ses_region: await EscalatedSetting.get('ses_region', config.inboundEmail?.ses?.region ?? 'us-east-1'),
      ses_topic_arn: await EscalatedSetting.get('ses_topic_arn', config.inboundEmail?.ses?.topicArn ?? ''),
      imap_host: await EscalatedSetting.get('imap_host', config.inboundEmail?.imap?.host ?? ''),
      imap_port: await EscalatedSetting.getInt('imap_port', config.inboundEmail?.imap?.port ?? 993),
      imap_encryption: await EscalatedSetting.get('imap_encryption', config.inboundEmail?.imap?.encryption ?? 'ssl'),
      imap_username: await EscalatedSetting.get('imap_username', config.inboundEmail?.imap?.username ?? ''),
      imap_password: this.maskSecret(await EscalatedSetting.get('imap_password', config.inboundEmail?.imap?.password ?? '')),
      imap_mailbox: await EscalatedSetting.get('imap_mailbox', config.inboundEmail?.imap?.mailbox ?? 'INBOX'),
    }
  }

  protected isMaskedValue(value: string | null): boolean {
    if (!value) return false
    return /^.{0,3}\*{3,}$/.test(value)
  }

  protected maskSecret(value: string | null): string {
    if (!value) return ''
    const len = value.length
    if (len <= 6) return '*'.repeat(len)
    return value.substring(0, 3) + '*'.repeat(Math.min(len - 3, 12))
  }
}
