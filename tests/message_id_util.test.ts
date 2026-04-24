import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMessageId,
  parseTicketIdFromMessageId,
  buildReplyTo,
  verifyReplyTo,
} from '../src/services/email/message_id_util.js'

/*
|--------------------------------------------------------------------------
| MessageIdUtil unit tests
|--------------------------------------------------------------------------
|
| Pure-function tests. Mirrors the NestJS / Spring / WordPress / .NET /
| Phoenix / Laravel / Rails / Django reference suites.
|
*/

const DOMAIN = 'support.example.com'
const SECRET = 'test-secret-long-enough-for-hmac'

describe('buildMessageId', () => {
  it('uses the ticket form when replyId is null', () => {
    assert.equal(buildMessageId(42, null, DOMAIN), '<ticket-42@support.example.com>')
  })

  it('uses the ticket form when replyId is undefined', () => {
    assert.equal(buildMessageId(42, undefined, DOMAIN), '<ticket-42@support.example.com>')
  })

  it('appends -reply-{id} when replyId is a number', () => {
    assert.equal(buildMessageId(42, 7, DOMAIN), '<ticket-42-reply-7@support.example.com>')
  })
})

describe('parseTicketIdFromMessageId', () => {
  it('round-trips built Message-IDs', () => {
    assert.equal(parseTicketIdFromMessageId(buildMessageId(42, null, DOMAIN)), 42)
    assert.equal(parseTicketIdFromMessageId(buildMessageId(42, 7, DOMAIN)), 42)
  })

  it('accepts values without angle brackets', () => {
    assert.equal(parseTicketIdFromMessageId('ticket-99@example.com'), 99)
  })

  it('returns null for nil, empty, or unrelated input', () => {
    assert.equal(parseTicketIdFromMessageId(null), null)
    assert.equal(parseTicketIdFromMessageId(undefined), null)
    assert.equal(parseTicketIdFromMessageId(''), null)
    assert.equal(parseTicketIdFromMessageId('<random@mail.com>'), null)
    assert.equal(parseTicketIdFromMessageId('ticket-abc@example.com'), null)
  })
})

describe('buildReplyTo', () => {
  it('is stable for the same inputs', () => {
    const first = buildReplyTo(42, SECRET, DOMAIN)
    const again = buildReplyTo(42, SECRET, DOMAIN)
    assert.equal(first, again)
    assert.match(first, /^reply\+42\.[a-f0-9]{8}@support\.example\.com$/)
  })

  it('produces different signatures across tickets', () => {
    const a = buildReplyTo(42, SECRET, DOMAIN)
    const b = buildReplyTo(43, SECRET, DOMAIN)
    assert.notEqual(a.split('@')[0], b.split('@')[0])
  })
})

describe('verifyReplyTo', () => {
  it('round-trips a built address', () => {
    const address = buildReplyTo(42, SECRET, DOMAIN)
    assert.equal(verifyReplyTo(address, SECRET), 42)
  })

  it('accepts the local part only', () => {
    const address = buildReplyTo(42, SECRET, DOMAIN)
    const local = address.split('@')[0]
    assert.equal(verifyReplyTo(local, SECRET), 42)
  })

  it('rejects a tampered signature', () => {
    const address = buildReplyTo(42, SECRET, DOMAIN)
    const at = address.indexOf('@')
    const local = address.slice(0, at)
    const last = local[local.length - 1]
    const tampered = local.slice(0, -1) + (last === '0' ? '1' : '0') + address.slice(at)
    assert.equal(verifyReplyTo(tampered, SECRET), null)
  })

  it('rejects a wrong secret', () => {
    const address = buildReplyTo(42, SECRET, DOMAIN)
    assert.equal(verifyReplyTo(address, 'different-secret'), null)
  })

  it('rejects malformed input', () => {
    assert.equal(verifyReplyTo(null, SECRET), null)
    assert.equal(verifyReplyTo(undefined, SECRET), null)
    assert.equal(verifyReplyTo('', SECRET), null)
    assert.equal(verifyReplyTo('alice@example.com', SECRET), null)
    assert.equal(verifyReplyTo('reply@example.com', SECRET), null)
    assert.equal(verifyReplyTo('reply+abc.deadbeef@example.com', SECRET), null)
  })

  it('is case-insensitive on the hex signature', () => {
    const address = buildReplyTo(42, SECRET, DOMAIN)
    assert.equal(verifyReplyTo(address.toUpperCase(), SECRET), 42)
  })
})
