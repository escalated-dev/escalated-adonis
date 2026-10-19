import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  crossOriginOf,
  invalidOriginEntries,
  isWidgetCsrfExempt,
  normalizeOriginPattern,
  resetWidgetOriginCache,
  setWidgetOriginSettingLoader,
  widgetOriginAllowed,
  widgetOriginAllowedNow,
  widgetOriginPatterns,
  WIDGET_CSRF_SKIPPED,
} from '../../src/support/widget_origins.ts'

/**
 * Which other sites may embed the widget: the `widget.allowedOrigins` config
 * list plus the `widget_allowed_origins` admin setting. Entries are bare
 * http(s) origins, optionally `https://*.example.com`; anything else is
 * rejected, and nothing is allowed until something is listed.
 */

let previousConfig: unknown

beforeEach(() => {
  previousConfig = (globalThis as any).__escalated_config
  ;(globalThis as any).__escalated_config = {}
  setWidgetOriginSettingLoader(async () => null)
  resetWidgetOriginCache()
})

afterEach(() => {
  ;(globalThis as any).__escalated_config = previousConfig
  setWidgetOriginSettingLoader(null)
  resetWidgetOriginCache()
})

function configure(allowedOrigins: unknown) {
  ;(globalThis as any).__escalated_config = { widget: { allowedOrigins } }
}

function request(origin: string | undefined, own = 'https://help.example.com') {
  const [protocol, host] = own.split('://')
  return {
    header: (name: string) => (name.toLowerCase() === 'origin' ? origin : undefined),
    protocol: () => protocol,
    host: () => host,
  }
}

describe('normalizeOriginPattern', () => {
  const cases: Array<[string, string | null]> = [
    ['https://Shop.Example.com', 'https://shop.example.com'],
    ['https://shop.example.com/', 'https://shop.example.com'],
    ['https://shop.example.com:443', 'https://shop.example.com'],
    ['http://shop.example.com:80', 'http://shop.example.com'],
    ['http://localhost:5173', 'http://localhost:5173'],
    ['  https://shop.example.com  ', 'https://shop.example.com'],
    ['https://*.example.com', 'https://*.example.com'],
    ['https://*.example.com:8443', 'https://*.example.com:8443'],
    ['https://shop.example.com/checkout', null],
    ['https://shop.example.com?x=1', null],
    ['https://shop.example.com#top', null],
    ['shop.example.com', null],
    ['*', null],
    ['https://*', null],
    ['https://a.*.example.com', null],
    ['ftp://shop.example.com', null],
    ['https://user@shop.example.com', null],
    ['null', null],
    ['', null],
  ]

  for (const [entry, expected] of cases) {
    it(`${JSON.stringify(entry)} -> ${JSON.stringify(expected)}`, () => {
      assert.equal(normalizeOriginPattern(entry), expected)
    })
  }
})

describe('origin matching', () => {
  const cases: Array<[string, boolean]> = [
    ['https://shop.example.com', true],
    ['https://SHOP.example.com:443', true],
    ['http://shop.example.com', false],
    ['https://shop.example.com:8443', false],
    ['https://help.brand.test', true],
    ['https://a.b.brand.test', true],
    ['https://brand.test', false],
    ['http://help.brand.test', false],
    ['https://notbrand.test', false],
    ['https://help.brand.test.evil.com', false],
    ['http://localhost:5173', true],
    ['http://localhost', false],
    ['null', false],
  ]

  for (const [origin, allowed] of cases) {
    it(`${origin} is ${allowed ? 'allowed' : 'refused'}`, async () => {
      configure(['https://shop.example.com', 'https://*.brand.test', 'http://localhost:5173'])

      assert.equal(await widgetOriginAllowed(origin), allowed)
      assert.equal(widgetOriginAllowedNow(origin), allowed)
    })
  }

  it('allows nothing until an origin is listed', async () => {
    assert.equal(await widgetOriginAllowed('https://shop.example.com'), false)
  })

  it('accepts the config list as a comma separated string (the env var form)', async () => {
    configure('https://shop.example.com, https://blog.example.com')

    assert.equal(await widgetOriginAllowed('https://blog.example.com'), true)
  })

  it('merges the config list with the admin setting, skipping invalid entries', async () => {
    configure(['https://shop.example.com'])
    setWidgetOriginSettingLoader(
      async () => 'https://blog.example.com, https://bad.example.com/path\n'
    )

    assert.deepEqual(await widgetOriginPatterns(), [
      'https://shop.example.com',
      'https://blog.example.com',
    ])
    assert.equal(await widgetOriginAllowed('https://blog.example.com'), true)
    assert.equal(await widgetOriginAllowed('https://bad.example.com'), false)
  })

  it('answers synchronously from the last setting it read', async () => {
    setWidgetOriginSettingLoader(async () => 'https://blog.example.com')

    assert.equal(widgetOriginAllowedNow('https://blog.example.com'), false)
    await widgetOriginPatterns()
    assert.equal(widgetOriginAllowedNow('https://blog.example.com'), true)
  })
})

describe('crossOriginOf', () => {
  const cases: Array<[string | undefined, string | null]> = [
    [undefined, null],
    ['', null],
    ['null', null],
    ['https://help.example.com', null],
    ['https://help.example.com:443', null],
    ['https://shop.example.com', 'https://shop.example.com'],
    ['http://help.example.com', 'http://help.example.com'],
    ['https://Shop.Example.com', 'https://shop.example.com'],
  ]

  for (const [origin, expected] of cases) {
    it(`Origin ${JSON.stringify(origin)} -> ${JSON.stringify(expected)}`, () => {
      assert.equal(crossOriginOf(request(origin)), expected)
    })
  }
})

describe('invalidOriginEntries', () => {
  it('lists every entry that is not a bare origin', () => {
    assert.deepEqual(
      invalidOriginEntries(
        'https://shop.example.com\n*\nhttps://a.example.com/x, https://*.ok.test'
      ),
      ['*', 'https://a.example.com/x']
    )
  })

  it('accepts an empty value', () => {
    assert.deepEqual(invalidOriginEntries(' \n '), [])
  })
})

describe('isWidgetCsrfExempt (for shield csrf.exceptRoutes)', () => {
  function ctx(routeName: string | undefined, origin: string | undefined) {
    return {
      route: routeName ? { name: routeName, pattern: '/support/widget/tickets' } : undefined,
      request: request(origin),
    } as any
  }

  it('exempts widget routes called from an allowed site, and marks the request', () => {
    configure(['https://shop.example.com'])
    const context = ctx('escalated.widget.tickets.create', 'https://shop.example.com')

    assert.equal(isWidgetCsrfExempt(context), true)
    assert.equal(context[WIDGET_CSRF_SKIPPED], true)
    assert.equal(
      isWidgetCsrfExempt(ctx('escalated.widget.chat.start', 'https://shop.example.com')),
      true
    )
  })

  it('keeps the check for other sites, the same site and requests without Origin', () => {
    configure(['https://shop.example.com'])

    assert.equal(
      isWidgetCsrfExempt(ctx('escalated.widget.tickets.create', 'https://evil.test')),
      false
    )
    assert.equal(
      isWidgetCsrfExempt(ctx('escalated.widget.tickets.create', 'https://help.example.com')),
      false
    )
    assert.equal(isWidgetCsrfExempt(ctx('escalated.widget.tickets.create', undefined)), false)
  })

  it('keeps the check on every non-widget route', () => {
    configure(['https://shop.example.com'])

    assert.equal(
      isWidgetCsrfExempt(ctx('escalated.guest.tickets.store', 'https://shop.example.com')),
      false
    )
    assert.equal(isWidgetCsrfExempt(ctx(undefined, 'https://shop.example.com')), false)
  })
})
