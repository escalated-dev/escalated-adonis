import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeWidgetMetadata } from '../../src/support/widget_metadata.ts'

/**
 * Host parameters an embedding page sends with a widget ticket or chat are
 * visitor supplied, so only a flat map of short scalar values is kept and
 * `embedded_on` comes from the request's Origin, never from the page.
 */

const SHOP = 'https://shop.example.com'

describe('sanitizeWidgetMetadata', () => {
  it('keeps flat scalar values and records where the widget was embedded', () => {
    const result = sanitizeWidgetMetadata(
      {
        'order_number': 'A-1001',
        'plan': ' pro ',
        'items': 3,
        'cart_total': 129.5,
        'vip': false,
        'page_url': 'https://shop.example.com/orders/A-1001',
        'embedded_on': 'https://spoofed.example',
        'nested': { not: 'kept' },
        'list': ['x'],
        'nothing': null,
        'bad key!': 'dropped',
        'note': 'a'.repeat(600),
      },
      SHOP
    )

    assert.equal(result.valid, true)
    assert.deepEqual(result.valid && result.metadata, {
      order_number: 'A-1001',
      plan: 'pro',
      items: 3,
      cart_total: 129.5,
      vip: false,
      page_url: 'https://shop.example.com/orders/A-1001',
      note: 'a'.repeat(500),
      embedded_on: SHOP,
    })
  })

  it('drops a page_url that is not an http(s) URL', () => {
    for (const pageUrl of ['javascript:alert(1)', 'not a url', 'ftp://shop.example.com/x', 42]) {
      const result = sanitizeWidgetMetadata({ page_url: pageUrl, plan: 'pro' }, null)
      assert.deepEqual(result.valid && result.metadata, { plan: 'pro' })
    }
  })

  it('drops a client embedded_on when the request is not from an allowed site', () => {
    const result = sanitizeWidgetMetadata({ embedded_on: SHOP }, null)
    assert.deepEqual(result, { valid: true, metadata: null })
  })

  it('keeps at most 25 entries', () => {
    const input = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`k${i}`, i]))
    const result = sanitizeWidgetMetadata(input, null)
    assert.equal(result.valid && Object.keys(result.metadata!).length, 25)
  })

  it('rejects keys longer than 64 characters', () => {
    const result = sanitizeWidgetMetadata({ ['k'.repeat(65)]: 1, ['k'.repeat(64)]: 2 }, null)
    assert.deepEqual(result.valid && result.metadata, { ['k'.repeat(64)]: 2 })
  })

  it('treats a missing or null metadata as none', () => {
    assert.deepEqual(sanitizeWidgetMetadata(undefined, null), { valid: true, metadata: null })
    assert.deepEqual(sanitizeWidgetMetadata(null, null), { valid: true, metadata: null })
    assert.deepEqual(sanitizeWidgetMetadata(undefined, SHOP), {
      valid: true,
      metadata: { embedded_on: SHOP },
    })
  })

  it('rejects metadata that is not an object or has more than 50 keys', () => {
    for (const input of ['x', 5, true, ['a']]) {
      assert.equal(sanitizeWidgetMetadata(input, null).valid, false)
    }
    const tooMany = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, i]))
    assert.equal(sanitizeWidgetMetadata(tooMany, null).valid, false)
    const fifty = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]))
    assert.equal(sanitizeWidgetMetadata(fifty, null).valid, true)
  })
})
