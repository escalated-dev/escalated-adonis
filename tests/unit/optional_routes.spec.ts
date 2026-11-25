import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { guestRoutesEnabled, widgetRoutesEnabled } from '../../src/support/optional_routes.ts'

/**
 * `widget.enabled` and `guest.routesEnabled`: the config value wins, else
 * ESCALATED_WIDGET_ENABLED / ESCALATED_GUEST_ROUTES, else on.
 */

const ENV = ['ESCALATED_WIDGET_ENABLED', 'ESCALATED_GUEST_ROUTES']
let previousConfig: unknown
let previousEnv: Record<string, string | undefined>

beforeEach(() => {
  previousConfig = (globalThis as any).__escalated_config
  previousEnv = Object.fromEntries(ENV.map((name) => [name, process.env[name]]))
  for (const name of ENV) delete process.env[name]
  ;(globalThis as any).__escalated_config = {}
})

afterEach(() => {
  ;(globalThis as any).__escalated_config = previousConfig
  for (const name of ENV) {
    if (previousEnv[name] === undefined) delete process.env[name]
    else process.env[name] = previousEnv[name]
  }
})

function config(value: Record<string, unknown>) {
  ;(globalThis as any).__escalated_config = value
}

describe('optional public routes', () => {
  it('are on by default', () => {
    assert.equal(widgetRoutesEnabled(), true)
    assert.equal(guestRoutesEnabled(), true)
  })

  it('follow the config', () => {
    config({ widget: { enabled: false }, guest: { routesEnabled: false } })
    assert.equal(widgetRoutesEnabled(), false)
    assert.equal(guestRoutesEnabled(), false)

    config({ widget: { enabled: true }, guest: { routesEnabled: true } })
    assert.equal(widgetRoutesEnabled(), true)
    assert.equal(guestRoutesEnabled(), true)
  })

  it('fall back to the environment when the config leaves them unset', () => {
    process.env.ESCALATED_WIDGET_ENABLED = 'false'
    process.env.ESCALATED_GUEST_ROUTES = '0'
    assert.equal(widgetRoutesEnabled(), false)
    assert.equal(guestRoutesEnabled(), false)

    process.env.ESCALATED_WIDGET_ENABLED = 'true'
    process.env.ESCALATED_GUEST_ROUTES = 'yes'
    assert.equal(widgetRoutesEnabled(), true)
    assert.equal(guestRoutesEnabled(), true)
  })

  it('let the config win over the environment', () => {
    process.env.ESCALATED_WIDGET_ENABLED = 'false'
    config({ widget: { enabled: true } })
    assert.equal(widgetRoutesEnabled(), true)
  })
})
