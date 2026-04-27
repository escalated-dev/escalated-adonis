import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import EmailThreadingService from '../src/services/email_threading_service.js'
import { verifyReplyTo } from '../src/services/email/message_id_util.js'

/*
|--------------------------------------------------------------------------
| EmailThreadingService (MessageIdUtil wire-up)
|--------------------------------------------------------------------------
|
| Verifies that the threading service now delegates to MessageIdUtil so
| the Message-ID format matches the canonical NestJS reference and the
| signed Reply-To round-trips through verifyReplyTo.
|
*/

const DOMAIN = 'support.example.com'
const SECRET = 'test-secret-for-hmac'

describe('EmailThreadingService.generateTicketMessageId', () => {
  it('produces the canonical ticket-{id} anchor', () => {
    const svc = new EmailThreadingService()
    assert.equal(svc.generateTicketMessageId(42, DOMAIN), '<ticket-42@support.example.com>')
  })
})

describe('EmailThreadingService.generateMessageId', () => {
  it('uses the anchor form when replyId is null', () => {
    const svc = new EmailThreadingService()
    assert.equal(svc.generateMessageId(42, null, DOMAIN), '<ticket-42@support.example.com>')
  })

  it('appends -reply-{id} for reply emails', () => {
    const svc = new EmailThreadingService()
    assert.equal(svc.generateMessageId(42, 7, DOMAIN), '<ticket-42-reply-7@support.example.com>')
  })
})

describe('EmailThreadingService.buildSignedReplyTo', () => {
  it('returns null when secret is blank', () => {
    const svc = new EmailThreadingService()
    assert.equal(svc.buildSignedReplyTo(42, DOMAIN, ''), null)
  })

  it('returns a signed address that verifyReplyTo round-trips', () => {
    const svc = new EmailThreadingService()
    const address = svc.buildSignedReplyTo(42, DOMAIN, SECRET)
    assert.ok(address)
    assert.match(address!, /^reply\+42\.[a-f0-9]{8}@support\.example\.com$/)
    assert.equal(verifyReplyTo(address, SECRET), 42)
  })

  it('produces different signatures for different tickets', () => {
    const svc = new EmailThreadingService()
    const a = svc.buildSignedReplyTo(42, DOMAIN, SECRET)
    const b = svc.buildSignedReplyTo(43, DOMAIN, SECRET)
    assert.notEqual(a!.split('@')[0], b!.split('@')[0])
  })
})

describe('EmailThreadingService.buildThreadingHeaders', () => {
  it('sets Message-ID, In-Reply-To, and References for replies', () => {
    const svc = new EmailThreadingService()
    const headers = svc.buildThreadingHeaders(42, 7, DOMAIN)

    assert.equal(headers['Message-ID'], '<ticket-42-reply-7@support.example.com>')
    assert.equal(headers['In-Reply-To'], '<ticket-42@support.example.com>')
    assert.equal(headers['References'], '<ticket-42@support.example.com>')
  })

  it('uses the inbound Message-ID for In-Reply-To when provided', () => {
    const svc = new EmailThreadingService()
    const inbound = '<CABC@mail.client.example.com>'
    const headers = svc.buildThreadingHeaders(42, 7, DOMAIN, inbound)

    assert.equal(headers['In-Reply-To'], inbound)
    // Ticket root still present in References chain.
    assert.match(headers['References'], /<ticket-42@support\.example\.com>/)
    // Inbound id also present.
    assert.ok(headers['References'].includes(inbound))
  })
})
