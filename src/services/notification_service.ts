import { createHash, createHmac } from 'node:crypto'

export default class NotificationService {
  /**
   * Send a webhook notification.
   */
  async sendWebhook(event: string, payload: Record<string, any>): Promise<void> {
    const config = (globalThis as any).__escalated_config
    const url = config?.notifications?.webhookUrl

    if (!url) return

    const body = {
      event,
      payload,
      timestamp: new Date().toISOString(),
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Sign the webhook payload if a secret is configured
    const secret = config?.notifications?.webhookSecret
    if (secret) {
      const signature = createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex')
      headers['X-Escalated-Signature'] = signature
    }

    try {
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // Webhook failures are non-fatal
    }
  }

  /**
   * Get configured notification channels.
   */
  getConfiguredChannels(): string[] {
    const config = (globalThis as any).__escalated_config
    return config?.notifications?.channels ?? ['mail', 'database']
  }
}
