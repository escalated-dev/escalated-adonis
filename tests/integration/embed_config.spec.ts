import { test } from '@japa/runner'
import {
  adminBasePath,
  embedAdmin,
  embedFrameAncestors,
  frameAncestorsDirective,
  resolveEmbed,
} from '../../src/support/embed.js'

/*
|--------------------------------------------------------------------------
| Embedding the admin: configuration
|--------------------------------------------------------------------------
|
| `ui.embed` in config/escalated.ts, its environment variables and
| `embedAdmin()` (ADR 2026-11-05-embeddable-admin). Off unless turned on.
|
*/

test.group('Embedding the admin: configuration', () => {
  test('off by default, with or without a ui.embed block', ({ assert }) => {
    assert.isNull(resolveEmbed({ ui: { enabled: true } }, {}))
    assert.isNull(resolveEmbed({ ui: { enabled: true, embed: {} } }, {}))
    assert.isNull(resolveEmbed({ ui: { enabled: true, embed: { enabled: false } } }, {}))
    assert.isNull(resolveEmbed({}, {}))
  })

  test('ESCALATED_EMBED and friends turn it on and fill unset keys', ({ assert }) => {
    const embed = resolveEmbed(
      { ui: { enabled: true } },
      {
        ESCALATED_EMBED: 'true',
        ESCALATED_EMBED_MODE: 'iframe',
        ESCALATED_EMBED_PREFIX: '/console/support/',
        ESCALATED_EMBED_FRAME_ANCESTORS: 'https://admin.example.com, *',
      }
    )
    assert.deepEqual(embed, {
      mode: 'iframe',
      prefix: 'console/support',
      middleware: null,
      replaceAdminGate: false,
      layout: null,
      rootView: null,
      frameAncestors: ['https://admin.example.com'],
    })
  })

  test('the config wins over the environment; screens off means off', ({ assert }) => {
    const env = { ESCALATED_EMBED: 'true', ESCALATED_EMBED_PREFIX: 'from-env' }
    assert.isNull(resolveEmbed({ ui: { enabled: true, embed: { enabled: false } } }, env))
    assert.isNull(resolveEmbed({ ui: { enabled: false } }, env))
    assert.equal(
      resolveEmbed({ ui: { enabled: true, embed: { prefix: 'from-config' } } }, env)?.prefix,
      'from-config'
    )
  })

  test('embedAdmin() turns it on with the defaults', ({ assert }) => {
    assert.deepEqual(embedAdmin({ layout: 'Layouts/AdminLayout' }), {
      enabled: true,
      mode: 'layout',
      prefix: 'admin/support',
      middleware: null,
      replaceAdminGate: false,
      layout: 'Layouts/AdminLayout',
      rootView: null,
      frameAncestors: [],
    })
  })

  test('embedAdmin() refuses an unknown mode, and replacing the gate without middleware', ({
    assert,
  }) => {
    assert.throws(() => embedAdmin({ mode: 'popup' as any }), /'layout' or 'iframe'/)
    assert.throws(() => embedAdmin({ replaceAdminGate: true }), /needs ui\.embed\.middleware/)
    assert.doesNotThrow(() => embedAdmin({ replaceAdminGate: true, middleware: ['auth', 'admin'] }))
  })

  test('frame ancestors are exact http(s) origins', ({ assert }) => {
    assert.deepEqual(
      embedFrameAncestors([
        'https://admin.example.com',
        'https://admin.example.com/',
        'http://localhost:3000',
        '*',
        'https://*.example.com',
        'https://example.com/admin',
        'https://example.com?x=1',
        'https://user:pass@example.com',
        'javascript:alert(1)',
        'admin.example.com',
        '',
      ]),
      ['https://admin.example.com', 'http://localhost:3000']
    )
    assert.equal(frameAncestorsDirective({ frameAncestors: [] }), "frame-ancestors 'self'")
  })

  test('the admin base path is the standalone one while embedding is off', async ({ assert }) => {
    const { testApp } = await import('./helpers/app.js')
    await testApp()
    assert.equal(adminBasePath(), '/support/admin')
  })
})
