import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  corsResponseHeaders,
  isPreflight,
  mergeVary,
  preflightHeaders,
} from '../../src/support/widget_cors.ts'

/**
 * The CORS headers the widget routes send. Allowed sites get their own origin
 * back (never `*`, never credentials); other sites get no grant at all.
 */

const SHOP = 'https://shop.example.com'

describe('widget CORS headers', () => {
  it('grants an allowed preflight', () => {
    assert.deepEqual(preflightHeaders(SHOP, 600), {
      'Access-Control-Allow-Origin': SHOP,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Requested-With',
      'Access-Control-Max-Age': '600',
      'Access-Control-Expose-Headers': 'Retry-After',
    })
  })

  it('answers a refused preflight with no grant', () => {
    assert.deepEqual(preflightHeaders(null, 600), {})
  })

  it('gives actual responses the origin and exposes Retry-After', () => {
    assert.deepEqual(corsResponseHeaders(SHOP), {
      'Access-Control-Allow-Origin': SHOP,
      'Access-Control-Expose-Headers': 'Retry-After',
    })
  })

  it('never sends Access-Control-Allow-Credentials', () => {
    const all = { ...preflightHeaders(SHOP, 600), ...corsResponseHeaders(SHOP) }
    assert.equal(
      Object.keys(all).some((name) => name.toLowerCase() === 'access-control-allow-credentials'),
      false
    )
  })

  it('appends Origin to Vary without clobbering it', () => {
    assert.equal(mergeVary(undefined), 'Origin')
    assert.equal(mergeVary(''), 'Origin')
    assert.equal(mergeVary('Accept-Encoding'), 'Accept-Encoding, Origin')
    assert.equal(mergeVary('Accept-Encoding, Origin'), 'Accept-Encoding, Origin')
    assert.equal(mergeVary(['Accept', 'Cookie']), 'Accept, Cookie, Origin')
  })

  it('recognises a preflight only by OPTIONS plus Access-Control-Request-Method', () => {
    assert.equal(isPreflight('OPTIONS', 'POST'), true)
    assert.equal(isPreflight('options', 'GET'), true)
    assert.equal(isPreflight('OPTIONS', undefined), false)
    assert.equal(isPreflight('POST', 'POST'), false)
  })
})
