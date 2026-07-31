import { DateTime } from 'luxon'
import Webhook from '../models/webhook.js'
import WebhookDelivery from '../models/webhook_delivery.js'
import {
  backoffSeconds,
  buildRequestBody,
  buildWebhookPayload,
  deliverWebhook,
  DEFAULT_TIMEOUT_MS,
  isSuccessfulStatus,
  truncateResponseBody,
  webhookHeaders,
} from '../support/webhook_events.js'

/**
 * Dispatches outbound webhooks to subscribed endpoints with HMAC-SHA256
 * signing, delivery logging, and exponential-backoff retries.
 *
 * Ported faithfully from the Laravel `WebhookDispatcher` service. Retries are
 * scheduled with an unref'd timer (no queue dependency in the Adonis port).
 */
export default class WebhookDispatcher {
  protected maxAttempts = 3

  /** Request timeout in milliseconds. */
  protected timeoutMs = DEFAULT_TIMEOUT_MS

  /**
   * Dispatch an event to every active webhook subscribed to it.
   */
  async dispatch(event: string, payload: Record<string, any>): Promise<void> {
    const webhooks = await Webhook.query().withScopes((scopes) => scopes.activeScope())

    for (const webhook of webhooks) {
      if (webhook.subscribedTo(event)) {
        await this.send(webhook, event, payload)
      }
    }
  }

  /**
   * Resolve the wire payload from an AdonisJS emitter event data object and
   * dispatch it. Loads the reply's ticket relation when needed so the payload
   * can include the ticket reference. Never throws — a failing endpoint must
   * not break the ticket mutation that emitted the event.
   */
  async dispatchFromEvent(event: string, data: any): Promise<void> {
    try {
      if (data?.reply && !data.reply.ticket && typeof data.reply.load === 'function') {
        try {
          await data.reply.load('ticket')
        } catch {
          // Ticket relation unavailable — payload falls back to ticketId.
        }
      }
      await this.dispatch(event, buildWebhookPayload(data))
    } catch (error) {
      console.warn('[Escalated] webhook dispatch failed:', (error as Error).message)
    }
  }

  /**
   * Send a single delivery with signing, logging, and retry-on-failure.
   */
  async send(
    webhook: Webhook,
    event: string,
    payload: Record<string, any>,
    attempt: number = 1
  ): Promise<void> {
    const body = buildRequestBody(event, payload)
    const headers = webhookHeaders(event, body, webhook.secret)

    const delivery = await WebhookDelivery.create({
      webhookId: webhook.id,
      event,
      payload,
      attempts: attempt,
    })

    try {
      const result = await deliverWebhook(webhook.url, body, headers, this.timeoutMs)

      delivery.merge({
        responseCode: result.status,
        responseBody: truncateResponseBody(result.body),
        deliveredAt: DateTime.now(),
        attempts: attempt,
      })
      await delivery.save()

      if (!isSuccessfulStatus(result.status) && attempt < this.maxAttempts) {
        this.retryLater(webhook, event, payload, attempt + 1)
      }
    } catch (error) {
      const message = (error as Error).message

      delivery.merge({
        responseCode: 0,
        responseBody: truncateResponseBody(message),
        attempts: attempt,
      })
      await delivery.save()

      console.warn('[Escalated] webhook delivery failed:', {
        webhookId: webhook.id,
        event,
        attempt,
        error: message,
      })

      if (attempt < this.maxAttempts) {
        this.retryLater(webhook, event, payload, attempt + 1)
      }
    }
  }

  /**
   * Schedule a retry after exponential backoff. Uses an unref'd timer so it
   * never keeps the process alive on its own.
   */
  protected retryLater(
    webhook: Webhook,
    event: string,
    payload: Record<string, any>,
    attempt: number
  ): void {
    const delayMs = backoffSeconds(attempt) * 1000

    const timer = setTimeout(() => {
      this.send(webhook, event, payload, attempt).catch((error) => {
        console.warn('[Escalated] webhook retry failed:', (error as Error).message)
      })
    }, delayMs)

    if (typeof timer.unref === 'function') {
      timer.unref()
    }
  }

  /**
   * Retry a specific stored delivery from attempt 1.
   */
  async retryDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = await Webhook.find(delivery.webhookId)
    if (webhook) {
      await this.send(webhook, delivery.event, delivery.payload ?? {}, 1)
    }
  }
}
