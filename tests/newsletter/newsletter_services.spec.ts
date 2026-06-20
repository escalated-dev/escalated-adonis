import { test } from '@japa/runner'
import { randomBytes } from 'node:crypto'
import NewsletterRenderer from '../../src/services/newsletter/newsletter_renderer.js'
import {
  assertEmail,
  assertOneOf,
  decodeTrackedUrl,
  discoverNewsletterThemes,
  NewsletterValidationError,
  optionalString,
  requiredString,
} from '../../src/support/newsletter_http.js'

function deliveryShape(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    newsletterId: 1,
    contactId: 1,
    emailAtSend: 'maria@example.com',
    status: 'sent',
    trackingToken: 'tok-abc123',
    sentAt: null,
    openedAt: null,
    lastClickedAt: null,
    clicksCount: 0,
    bounceReason: null,
    failureReason: null,
    attemptCount: 0,
    claimedAt: null,
    isTest: false,
    newsletter: {
      id: 1,
      subject: 'Hello',
      fromEmail: 'hi@example.com',
      fromName: null,
      replyTo: null,
      bodyMarkdown: 'Hi {{ contact.first_name }}!',
      theme: 'default',
      template: null,
    },
    contact: { id: 1, email: 'maria@example.com', name: 'Maria Lopez', metadata: {} },
    ...overrides,
  }
}

test.group('NewsletterRenderer', () => {
  test('renders markdown and merge fields', ({ assert }) => {
    const renderer = new NewsletterRenderer({
      baseUrl: 'http://localhost',
      trackingEnabled: true,
      markdownToHtml: (md) => `<h1>${md.replace(/^#\s*/, '')}</h1>`,
    })
    const html = renderer.render(deliveryShape() as any)
    assert.include(html, 'Maria')
    assert.notInclude(html, '{{ contact.first_name }}')
  })

  test('unknown merge fields render empty', ({ assert }) => {
    const renderer = new NewsletterRenderer({
      baseUrl: 'http://localhost',
      trackingEnabled: false,
      markdownToHtml: () => 'Hello {{ contact.does_not_exist }}',
    })
    const html = renderer.render(deliveryShape() as any)
    assert.notInclude(html, '{{')
    assert.include(html, 'Hello')
  })

  test('rewrites links and injects pixel when tracking enabled', ({ assert }) => {
    const renderer = new NewsletterRenderer({
      baseUrl: 'http://localhost',
      trackingEnabled: true,
      markdownToHtml: () =>
        '<a href="https://example.com">link</a><a href="http://localhost/escalated/n/u/tok">unsub</a>',
    })
    const html = renderer.render(deliveryShape({ trackingToken: 'tok' }) as any)
    assert.include(html, '/escalated/n/c/tok')
    assert.notInclude(html, 'https://example.com')
    assert.include(html, '/escalated/n/o/tok.gif')
  })

  test('strips javascript: links instead of proxying', ({ assert }) => {
    const renderer = new NewsletterRenderer({
      baseUrl: 'http://localhost',
      trackingEnabled: true,
      markdownToHtml: () => '<a href="javascript:alert(1)">bad</a>',
    })
    const html = renderer.render(deliveryShape({ trackingToken: 'tok' }) as any)
    assert.notInclude(html, '/escalated/n/c/')
    assert.include(html, 'href="#"')
  })

  test('skips tracking rewrite when disabled', ({ assert }) => {
    const renderer = new NewsletterRenderer({
      baseUrl: 'http://localhost',
      trackingEnabled: false,
      markdownToHtml: () => '<a href="https://example.com">link</a>',
    })
    const html = renderer.render(deliveryShape({ trackingToken: 'tok' }) as any)
    assert.include(html, 'https://example.com')
    assert.notInclude(html, '/escalated/n/o/')
  })
})

test.group('Newsletter HTTP utils', () => {
  test('decodeTrackedUrl accepts url-safe base64', ({ assert }) => {
    const encoded = Buffer.from('https://example.com/path')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    assert.equal(decodeTrackedUrl(encoded), 'https://example.com/path')
  })

  test('rejects non-http(s) decoded URLs', ({ assert }) => {
    const encoded = Buffer.from('javascript:alert(1)')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    assert.throws(() => decodeTrackedUrl(encoded), NewsletterValidationError)
  })

  test('discoverNewsletterThemes includes packaged themes', ({ assert }) => {
    const themes = discoverNewsletterThemes()
    assert.includeMembers(themes, ['default', 'branded'])
  })

  test('validate required email fields', ({ assert }) => {
    assert.equal(assertEmail('a@example.com', 'from_email', true), 'a@example.com')
    assert.throws(() => assertEmail('not-an-email', 'from_email', true))
  })

  test('validate newsletter status enum', ({ assert }) => {
    assert.equal(assertOneOf('draft', 'status', ['draft', 'scheduled', 'sending']), 'draft')
    assert.throws(() => assertOneOf('sent', 'status', ['draft', 'scheduled', 'sending']))
  })

  test('requiredString enforces max length', ({ assert }) => {
    assert.throws(() => requiredString({ subject: 'x'.repeat(999) }, 'subject', 998))
    assert.equal(requiredString({ subject: 'Hello' }, 'subject', 998), 'Hello')
  })

  test('optionalString allows null', ({ assert }) => {
    assert.isNull(optionalString({}, 'reply_to'))
  })
})

test.group('ESP webhook token parsing', () => {
  test('extracts token from Message-ID header format', ({ assert }) => {
    const messageId = '<n-42-AbCdEf1234567890123456789012345678901234@mail.example.com>'
    const matched = messageId.match(/n-\d+-([A-Za-z0-9]+)@/)
    assert.equal(matched?.[1], 'AbCdEf1234567890123456789012345678901234')
  })

  test('extracts token from local-part fallback', ({ assert }) => {
    const local = 'n-42-abc123XYZ'
    const localMatched = local.match(/^n-\d+-([A-Za-z0-9]+)$/)
    assert.equal(localMatched?.[1], 'abc123XYZ')
  })
})

test('tracking tokens are 40 hex chars', ({ assert }) => {
  const token = randomBytes(20).toString('hex')
  assert.equal(token.length, 40)
})
