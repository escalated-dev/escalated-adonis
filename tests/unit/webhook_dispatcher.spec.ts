import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  WEBHOOK_EVENTS,
  ESCALATED_EVENT_WEBHOOK_MAP,
  buildWebhookPayload,
  buildRequestBody,
  signWebhookBody,
  webhookHeaders,
  truncateResponseBody,
  isSuccessfulStatus,
  backoffSeconds,
  deliverWebhook,
} from '../../src/support/webhook_events.ts'
import { ESCALATED_EVENTS } from '../../src/events/index.ts'

describe('webhook event catalogue', () => {
  it('exposes the canonical 17 wire event names', () => {
    assert.equal(WEBHOOK_EVENTS.length, 17)
    assert.ok(WEBHOOK_EVENTS.includes('ticket.created'))
    assert.ok(WEBHOOK_EVENTS.includes('reply.created'))
    assert.ok(WEBHOOK_EVENTS.includes('note.created'))
    assert.ok(WEBHOOK_EVENTS.includes('ticket.tag_added'))
    assert.ok(WEBHOOK_EVENTS.includes('ticket.tag_removed'))
    assert.ok(WEBHOOK_EVENTS.includes('sla.breached'))
  })

  it('maps internal emitter events to valid wire names, including the required subset', () => {
    const allowed = new Set<string>(WEBHOOK_EVENTS)
    for (const wire of Object.values(ESCALATED_EVENT_WEBHOOK_MAP)) {
      assert.ok(allowed.has(wire), `unexpected wire name: ${wire}`)
    }
    assert.equal(ESCALATED_EVENT_WEBHOOK_MAP[ESCALATED_EVENTS.TICKET_CREATED], 'ticket.created')
    assert.equal(ESCALATED_EVENT_WEBHOOK_MAP[ESCALATED_EVENTS.REPLY_CREATED], 'reply.created')
    assert.equal(ESCALATED_EVENT_WEBHOOK_MAP[ESCALATED_EVENTS.INTERNAL_NOTE_ADDED], 'note.created')
    assert.equal(ESCALATED_EVENT_WEBHOOK_MAP[ESCALATED_EVENTS.TAG_ADDED], 'ticket.tag_added')
    assert.equal(
      ESCALATED_EVENT_WEBHOOK_MAP[ESCALATED_EVENTS.DEPARTMENT_CHANGED],
      'ticket.department_changed'
    )
  })

  it('keeps map keys in sync with the ESCALATED_EVENTS constant (drift guard)', () => {
    // Every mapped emitter key must be a real ESCALATED_EVENTS value, so the
    // provider's `emitter.on(key, ...)` wiring actually fires.
    const known = new Set<string>(Object.values(ESCALATED_EVENTS))
    for (const key of Object.keys(ESCALATED_EVENT_WEBHOOK_MAP)) {
      assert.ok(known.has(key), `map key not a known ESCALATED_EVENTS value: ${key}`)
    }
  })
})

describe('buildWebhookPayload', () => {
  it('shapes a ticket payload from a ticket event', () => {
    const payload = buildWebhookPayload({
      ticket: { id: 7, reference: 'TKT-7', subject: 'Broken', status: 'open', priority: 'high' },
    })
    assert.deepEqual(payload, {
      ticket: { id: 7, reference: 'TKT-7', subject: 'Broken', status: 'open', priority: 'high' },
    })
  })

  it('shapes a reply payload using the loaded ticket relation', () => {
    const payload = buildWebhookPayload({
      reply: { id: 42, isInternalNote: false, ticketId: 7, ticket: { id: 7, reference: 'TKT-7' } },
    })
    assert.deepEqual(payload, {
      ticket: { id: 7, reference: 'TKT-7' },
      reply: { id: 42, is_internal_note: false },
    })
  })

  it('falls back to ticketId when the reply ticket relation is not loaded', () => {
    const payload = buildWebhookPayload({
      reply: { id: 42, isInternalNote: true, ticketId: 7 },
    })
    assert.deepEqual(payload, {
      ticket: { id: 7 },
      reply: { id: 42, is_internal_note: true },
    })
  })

  it('includes tag and agent_id when present', () => {
    const payload = buildWebhookPayload({
      ticket: { id: 1, reference: 'T1', subject: 's', status: 'open', priority: 'low' },
      tag: { id: 3, name: 'urgent' },
      agentId: 99,
    })
    assert.deepEqual(payload.tag, { id: 3, name: 'urgent' })
    assert.equal(payload.agent_id, 99)
  })

  it('omits agent_id when null/undefined', () => {
    const payload = buildWebhookPayload({
      ticket: { id: 1, reference: 'T1', subject: 's', status: 'open', priority: 'low' },
      agentId: null,
    })
    assert.ok(!('agent_id' in payload))
  })
})

describe('request body + signing', () => {
  it('serializes the {event, payload, timestamp} envelope', () => {
    const body = buildRequestBody(
      'ticket.created',
      { ticket: { id: 1 } },
      '2026-01-01T00:00:00.000Z'
    )
    assert.deepEqual(JSON.parse(body), {
      event: 'ticket.created',
      payload: { ticket: { id: 1 } },
      timestamp: '2026-01-01T00:00:00.000Z',
    })
  })

  it('produces a deterministic hex HMAC-SHA256 matching a fixed vector', () => {
    const body = buildRequestBody(
      'ticket.created',
      { ticket: { id: 1 } },
      '2026-01-01T00:00:00.000Z'
    )
    const sig = signWebhookBody(body, 's3cr3t')
    assert.match(sig, /^[0-9a-f]{64}$/)
    assert.equal(sig, 'be303dbf5318c010b1cc2b25255c9705814ffb85731d79eeb665be571f6715df')
  })

  it('changes signature when the secret changes', () => {
    const body = 'x'
    assert.notEqual(signWebhookBody(body, 'a'), signWebhookBody(body, 'b'))
  })

  it('only adds the signature header when a secret is set', () => {
    const withSecret = webhookHeaders('ticket.created', 'body', 'secret')
    assert.equal(withSecret['Content-Type'], 'application/json')
    assert.equal(withSecret['X-Escalated-Event'], 'ticket.created')
    assert.ok(withSecret['X-Escalated-Signature'])

    const noSecret = webhookHeaders('ticket.created', 'body', null)
    assert.ok(!('X-Escalated-Signature' in noSecret))
  })
})

describe('response handling helpers', () => {
  it('truncates response bodies to 2000 chars', () => {
    assert.equal(truncateResponseBody('a'.repeat(2500)).length, 2000)
    assert.equal(truncateResponseBody('short'), 'short')
    assert.equal(truncateResponseBody(undefined as any), '')
  })

  it('recognises 2xx as success', () => {
    assert.equal(isSuccessfulStatus(200), true)
    assert.equal(isSuccessfulStatus(299), true)
    assert.equal(isSuccessfulStatus(199), false)
    assert.equal(isSuccessfulStatus(300), false)
    assert.equal(isSuccessfulStatus(500), false)
  })

  it('computes exponential backoff (2^attempt * 30s)', () => {
    assert.equal(backoffSeconds(2), 120)
    assert.equal(backoffSeconds(3), 240)
  })
})

describe('deliverWebhook — real HTTP round-trip', () => {
  let server: Server
  let baseUrl: string
  const received: { headers: Record<string, any>; body: string; url: string }[] = []
  let nextStatus = 200
  let nextBody = 'ok'

  before(async () => {
    server = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        received.push({ headers: req.headers, body, url: req.url ?? '' })
        res.writeHead(nextStatus, { 'Content-Type': 'text/plain' })
        res.end(nextBody)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as AddressInfo).port
    baseUrl = `http://127.0.0.1:${port}`
  })

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('POSTs the signed body and returns status + body', async () => {
    nextStatus = 200
    nextBody = 'received'
    const body = buildRequestBody(
      'ticket.created',
      { ticket: { id: 1 } },
      '2026-01-01T00:00:00.000Z'
    )
    const headers = webhookHeaders('ticket.created', body, 's3cr3t')

    const result = await deliverWebhook(`${baseUrl}/hook`, body, headers)

    assert.equal(result.status, 200)
    assert.equal(result.body, 'received')

    const last = received.at(-1)!
    assert.equal(last.url, '/hook')
    assert.equal(last.headers['x-escalated-event'], 'ticket.created')
    assert.equal(last.headers['content-type'], 'application/json')
    assert.equal(
      last.headers['x-escalated-signature'],
      'be303dbf5318c010b1cc2b25255c9705814ffb85731d79eeb665be571f6715df'
    )
    assert.equal(last.body, body)
  })

  it('returns a non-2xx status without throwing', async () => {
    nextStatus = 500
    nextBody = 'boom'
    const result = await deliverWebhook(`${baseUrl}/hook`, '{}', {
      'Content-Type': 'application/json',
    })
    assert.equal(result.status, 500)
    assert.equal(isSuccessfulStatus(result.status), false)
  })
})
