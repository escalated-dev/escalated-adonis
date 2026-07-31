/**
 * Pure helpers for the outbound-webhooks subsystem.
 *
 * This module is intentionally a leaf (only `node:crypto`) so its logic —
 * event mapping, payload shaping, HMAC signing, body truncation, retry
 * backoff, and the raw HTTP delivery — can be unit-tested against source
 * without a build step, mirroring the approach used by `ticket_link_types.ts`.
 * Mirrors the Laravel `WebhookDispatcher` / `DispatchWebhook` contract.
 */

import { createHmac } from 'node:crypto'

/**
 * The canonical set of outbound webhook event names (the "wire" names sent in
 * the `X-Escalated-Event` header and the JSON body's `event` field). This is
 * the list surfaced to admins when subscribing a webhook.
 */
export const WEBHOOK_EVENTS = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.resolved',
  'ticket.closed',
  'ticket.reopened',
  'ticket.assigned',
  'ticket.unassigned',
  'ticket.escalated',
  'ticket.priority_changed',
  'ticket.department_changed',
  'reply.created',
  'note.created',
  'sla.breached',
  'sla.warning',
  'ticket.tag_added',
  'ticket.tag_removed',
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

/**
 * Maps the internal AdonisJS emitter event name (the literal `ESCALATED_EVENTS`
 * string values from `src/events/index.ts`) to the public webhook wire name.
 * Only events present here are forwarded to subscribed webhooks. The keys are
 * kept as literals so this module stays a dependency-free leaf; the
 * `webhook_dispatcher.spec.ts` drift-guard test asserts they stay in sync with
 * the `ESCALATED_EVENTS` constant.
 */
export const ESCALATED_EVENT_WEBHOOK_MAP: Record<string, WebhookEvent> = {
  'escalated:ticket:created': 'ticket.created',
  'escalated:ticket:updated': 'ticket.updated',
  'escalated:ticket:statusChanged': 'ticket.status_changed',
  'escalated:ticket:resolved': 'ticket.resolved',
  'escalated:ticket:closed': 'ticket.closed',
  'escalated:ticket:reopened': 'ticket.reopened',
  'escalated:ticket:assigned': 'ticket.assigned',
  'escalated:ticket:unassigned': 'ticket.unassigned',
  'escalated:ticket:escalated': 'ticket.escalated',
  'escalated:ticket:priorityChanged': 'ticket.priority_changed',
  'escalated:ticket:departmentChanged': 'ticket.department_changed',
  'escalated:reply:created': 'reply.created',
  'escalated:reply:noteAdded': 'note.created',
  'escalated:sla:breached': 'sla.breached',
  'escalated:sla:warning': 'sla.warning',
  'escalated:tag:added': 'ticket.tag_added',
  'escalated:tag:removed': 'ticket.tag_removed',
}

/** Maximum number of characters persisted from a webhook response body. */
export const MAX_RESPONSE_BODY = 2000

/** Default outbound request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000

/** Result of a raw HTTP delivery attempt. */
export interface DeliveryResult {
  status: number
  body: string
}

/**
 * Build the webhook JSON payload from an AdonisJS emitter event data object.
 *
 * Reads whatever of `ticket`, `reply`, `tag`, `agentId` are present — matching
 * the Laravel `DispatchWebhook::buildPayload()` shape. Works against Lucid
 * model instances or plain objects (camelCase), so it is trivially testable.
 */
export function buildWebhookPayload(data: any): Record<string, any> {
  const payload: Record<string, any> = {}

  if (data?.ticket) {
    const t = data.ticket
    payload.ticket = {
      id: t.id,
      reference: t.reference,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
    }
  }

  if (data?.reply) {
    const r = data.reply
    const t = r.ticket
    payload.ticket = t ? { id: t.id, reference: t.reference } : { id: r.ticketId }
    payload.reply = {
      id: r.id,
      is_internal_note: r.isInternalNote ?? r.is_internal_note ?? false,
    }
  }

  if (data?.tag) {
    payload.tag = { id: data.tag.id, name: data.tag.name }
  }

  if (data?.agentId !== undefined && data?.agentId !== null) {
    payload.agent_id = data.agentId
  }

  return payload
}

/**
 * Serialize the outbound request body: `{ event, payload, timestamp }`.
 * `timestamp` is an ISO-8601 string (defaults to now).
 */
export function buildRequestBody(
  event: string,
  payload: Record<string, any>,
  timestamp: string = new Date().toISOString()
): string {
  return JSON.stringify({ event, payload, timestamp })
}

/** Compute the hex-encoded HMAC-SHA256 signature of `body` using `secret`. */
export function signWebhookBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * Build the outbound HTTP headers, including the HMAC signature header when a
 * secret is configured on the webhook.
 */
export function webhookHeaders(
  event: string,
  body: string,
  secret?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Escalated-Event': event,
  }
  if (secret) {
    headers['X-Escalated-Signature'] = signWebhookBody(body, secret)
  }
  return headers
}

/** Truncate a response body to at most `max` characters (default 2000). */
export function truncateResponseBody(text: string, max: number = MAX_RESPONSE_BODY): string {
  return (text ?? '').slice(0, max)
}

/** Whether an HTTP status code counts as a successful delivery (2xx). */
export function isSuccessfulStatus(code: number): boolean {
  return code >= 200 && code < 300
}

/**
 * Exponential backoff (in seconds) before the given retry attempt.
 * Mirrors Laravel: `2^attempt * 30` → 120s, 240s for attempts 2 and 3.
 */
export function backoffSeconds(attempt: number): number {
  return Math.pow(2, attempt) * 30
}

/**
 * Perform the raw HTTP POST with an AbortController timeout. Returns the
 * response status and body text; throws on network error / timeout.
 */
export async function deliverWebhook(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<DeliveryResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })
    const text = await response.text()
    return { status: response.status, body: text }
  } finally {
    clearTimeout(timer)
  }
}
