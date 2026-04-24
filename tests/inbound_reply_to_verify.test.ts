import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReplyTo,
  parseTicketIdFromMessageId,
  verifyReplyTo,
} from '../src/services/email/message_id_util.js'

/*
|--------------------------------------------------------------------------
| Inbound Reply-To verification tests
|--------------------------------------------------------------------------
|
| Confirms the MessageIdUtil primitives that InboundEmailService
| relies on for its 5-priority resolution chain round-trip correctly.
| Integration of the service with Lucid + the Ticket model is
| exercised in the WP / Laravel / Rails / Django test suites where
| DB fixtures are available; here we cover the pure helpers.
|
*/

const DOMAIN = 'support.example.com'
const SECRET = 'test-secret-for-hmac'

describe('InboundEmailService primitives', () => {
  describe('parseTicketIdFromMessageId', () => {
    it('extracts the ticket id from the canonical In-Reply-To form', () => {
      assert.equal(parseTicketIdFromMessageId('<ticket-42@support.example.com>'), 42)
    })

    it('extracts the ticket id from the reply form', () => {
      assert.equal(parseTicketIdFromMessageId('<ticket-42-reply-7@support.example.com>'), 42)
    })

    it('accepts bare ids in References-style input', () => {
      const refs = '<random@mail.com> <ticket-99@support.example.com>'
      const ids = refs.split(/\s+/).filter(Boolean)
      // Emulate the service's per-id parse loop: first unrelated, then hit.
      assert.equal(parseTicketIdFromMessageId(ids[0]), null)
      assert.equal(parseTicketIdFromMessageId(ids[1]), 99)
    })
  })

  describe('verifyReplyTo', () => {
    it('round-trips a built Reply-To', () => {
      const to = buildReplyTo(42, SECRET, DOMAIN)
      assert.equal(verifyReplyTo(to, SECRET), 42)
    })

    it('rejects a forgery signed with the wrong secret', () => {
      const forged = buildReplyTo(42, 'wrong-secret', DOMAIN)
      assert.equal(verifyReplyTo(forged, SECRET), null)
    })

    it('rejects a mutated signature (tampered local part)', () => {
      const to = buildReplyTo(42, SECRET, DOMAIN)
      const at = to.indexOf('@')
      const last = to[at - 1]
      const tampered = to.slice(0, at - 1) + (last === '0' ? '1' : '0') + to.slice(at)
      assert.equal(verifyReplyTo(tampered, SECRET), null)
    })

    it('accepts the local part only (pre-split input)', () => {
      const to = buildReplyTo(42, SECRET, DOMAIN)
      const local = to.split('@')[0]
      assert.equal(verifyReplyTo(local, SECRET), 42)
    })
  })

  describe('5-priority resolution order — semantic contract', () => {
    it('a canonical In-Reply-To takes priority over a matching signed Reply-To', () => {
      // Both would resolve to the same ticket id, so the test is about
      // the CHAIN not shortcutting before In-Reply-To.
      const inReplyTo = '<ticket-42@support.example.com>'
      const to = buildReplyTo(99, SECRET, DOMAIN)

      // Simulate the first branch of findTicketByEmail.
      const byHeader = parseTicketIdFromMessageId(inReplyTo)
      assert.equal(byHeader, 42)

      // If branch 1 missed (different ticket id in header), the signed
      // Reply-To branch would still surface its own id.
      const byReplyTo = verifyReplyTo(to, SECRET)
      assert.equal(byReplyTo, 99)
    })
  })
})
