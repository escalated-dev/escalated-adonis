import { buildMessageId, buildReplyTo } from './email/message_id_util.js'
import EscalatedSetting from '../models/escalated_setting.js'

/**
 * Service for generating email threading headers and branded email content.
 *
 * Ensures outbound emails include proper In-Reply-To, References, and
 * Message-ID headers so mail clients group ticket conversations into
 * threads. Delegates Message-ID generation to `MessageIdUtil` so the
 * format matches the canonical NestJS reference and inbound Reply-To
 * verification has something to check against.
 */
export default class EmailThreadingService {
  /**
   * Generate the Message-ID for an outbound email. For initial ticket
   * notifications pass `replyId = null`; for agent replies pass the
   * reply id so the Message-ID carries `-reply-{replyId}`.
   */
  generateMessageId(ticketId: number, replyId: number | null, domain: string): string {
    return buildMessageId(ticketId, replyId, domain)
  }

  /**
   * Generate the root Message-ID for a ticket (used as the thread anchor).
   */
  generateTicketMessageId(ticketId: number, domain: string): string {
    return buildMessageId(ticketId, null, domain)
  }

  /**
   * Build a signed Reply-To address (`reply+{id}.{hmac8}@{domain}`) so
   * inbound provider webhooks can verify ticket identity even when
   * clients strip our Message-ID / In-Reply-To headers. Returns `null`
   * when `secret` is blank (signing disabled).
   */
  buildSignedReplyTo(ticketId: number, domain: string, secret: string): string | null {
    if (!secret) return null
    return buildReplyTo(ticketId, secret, domain)
  }

  /**
   * Build threading headers for an outbound reply email.
   *
   * - Message-ID: canonical `<ticket-{id}(-reply-{replyId})?@{domain}>`
   * - In-Reply-To: the ticket's root Message-ID (or the inbound message-id if replying to one)
   * - References: chain of Message-IDs for the thread
   */
  buildThreadingHeaders(
    ticketId: number,
    replyId: number | null,
    domain: string,
    inboundMessageId?: string | null,
    existingReferences?: string | null
  ): Record<string, string> {
    const messageId = this.generateMessageId(ticketId, replyId, domain)
    const ticketRootId = this.generateTicketMessageId(ticketId, domain)

    const inReplyTo = inboundMessageId || ticketRootId

    // Build References chain: root + previous references + in-reply-to
    const refs: string[] = [ticketRootId]
    if (existingReferences) {
      const parsed = existingReferences
        .split(/\s+/)
        .filter((r) => r.startsWith('<') && r.endsWith('>'))
      for (const ref of parsed) {
        if (!refs.includes(ref)) {
          refs.push(ref)
        }
      }
    }
    if (inboundMessageId && !refs.includes(inboundMessageId)) {
      refs.push(inboundMessageId)
    }

    return {
      'Message-ID': messageId,
      'In-Reply-To': inReplyTo,
      'References': refs.join(' '),
    }
  }

  /**
   * Load branding settings for email templates.
   */
  async getBrandingSettings(): Promise<{
    logoUrl: string | null
    accentColor: string
    footerText: string
  }> {
    const [logoUrl, accentColor, footerText] = await Promise.all([
      EscalatedSetting.get('email_logo_url', null),
      EscalatedSetting.get('email_accent_color', '#3B82F6'),
      EscalatedSetting.get('email_footer_text', 'Powered by Escalated'),
    ])

    return {
      logoUrl,
      accentColor: accentColor ?? '#3B82F6',
      footerText: footerText ?? 'Powered by Escalated',
    }
  }

  /**
   * Build branded email HTML wrapper.
   */
  buildBrandedHtml(
    body: string,
    branding: { logoUrl: string | null; accentColor: string; footerText: string }
  ): string {
    const logoHtml = branding.logoUrl
      ? `<div style="text-align:center;margin-bottom:20px;"><img src="${branding.logoUrl}" alt="Logo" style="max-height:48px;" /></div>`
      : ''

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2937;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    ${logoHtml}
    <div style="border-top:3px solid ${branding.accentColor};padding-top:20px;">
      ${body}
    </div>
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;">
      ${branding.footerText}
    </div>
  </div>
</body>
</html>`
  }
}
