import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Config Helper Tests
|--------------------------------------------------------------------------
|
| Tests for getConfig(), tablePrefix(), and table() from
| src/helpers/config.ts.
|
| These helpers read from globalThis.__escalated_config, which we
| can set directly in tests.
|
*/

// ──────────────────────────────────────────────────────────────────
// Re-implement pure functions from src/helpers/config.ts
// ──────────────────────────────────────────────────────────────────

function getConfig() {
  return globalThis.__escalated_config ?? {}
}

function tablePrefix() {
  return getConfig().tablePrefix ?? 'escalated_'
}

function table(name) {
  return `${tablePrefix()}${name}`
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('getConfig()', () => {
  let originalConfig

  beforeEach(() => {
    originalConfig = globalThis.__escalated_config
  })

  afterEach(() => {
    globalThis.__escalated_config = originalConfig
  })

  it('returns empty object when no config is set', () => {
    delete globalThis.__escalated_config
    const config = getConfig()
    assert.deepStrictEqual(config, {})
  })

  it('returns empty object when config is null', () => {
    globalThis.__escalated_config = null
    const config = getConfig()
    assert.deepStrictEqual(config, {})
  })

  it('returns empty object when config is undefined', () => {
    globalThis.__escalated_config = undefined
    const config = getConfig()
    assert.deepStrictEqual(config, {})
  })

  it('returns the config object when set', () => {
    const expected = { tablePrefix: 'test_', mode: 'self-hosted' }
    globalThis.__escalated_config = expected
    const config = getConfig()
    assert.deepStrictEqual(config, expected)
  })

  it('returns a reference to the same object (not a copy)', () => {
    const expected = { tablePrefix: 'test_' }
    globalThis.__escalated_config = expected
    const config = getConfig()
    assert.equal(config, expected)
  })

  it('reflects runtime changes to the global config', () => {
    globalThis.__escalated_config = { tablePrefix: 'first_' }
    assert.equal(getConfig().tablePrefix, 'first_')

    globalThis.__escalated_config = { tablePrefix: 'second_' }
    assert.equal(getConfig().tablePrefix, 'second_')
  })
})

describe('tablePrefix()', () => {
  let originalConfig

  beforeEach(() => {
    originalConfig = globalThis.__escalated_config
  })

  afterEach(() => {
    globalThis.__escalated_config = originalConfig
  })

  it('returns "escalated_" as the default prefix', () => {
    delete globalThis.__escalated_config
    assert.equal(tablePrefix(), 'escalated_')
  })

  it('returns "escalated_" when config has no tablePrefix', () => {
    globalThis.__escalated_config = {}
    assert.equal(tablePrefix(), 'escalated_')
  })

  it('returns "escalated_" when config is null', () => {
    globalThis.__escalated_config = null
    assert.equal(tablePrefix(), 'escalated_')
  })

  it('returns the configured prefix', () => {
    globalThis.__escalated_config = { tablePrefix: 'support_' }
    assert.equal(tablePrefix(), 'support_')
  })

  it('returns empty string when prefix is explicitly empty', () => {
    globalThis.__escalated_config = { tablePrefix: '' }
    // Empty string is NOT nullish, so ?? does NOT fall back to the default.
    // The nullish coalescing operator (??) only triggers for null/undefined.
    assert.equal(tablePrefix(), '')
  })

  it('handles custom prefix with no trailing underscore', () => {
    globalThis.__escalated_config = { tablePrefix: 'helpdesk' }
    assert.equal(tablePrefix(), 'helpdesk')
  })

  it('handles prefix with special characters', () => {
    globalThis.__escalated_config = { tablePrefix: 'app_support_' }
    assert.equal(tablePrefix(), 'app_support_')
  })
})

describe('table()', () => {
  let originalConfig

  beforeEach(() => {
    originalConfig = globalThis.__escalated_config
  })

  afterEach(() => {
    globalThis.__escalated_config = originalConfig
  })

  it('prefixes table names with default "escalated_"', () => {
    delete globalThis.__escalated_config
    assert.equal(table('tickets'), 'escalated_tickets')
    assert.equal(table('replies'), 'escalated_replies')
    assert.equal(table('tags'), 'escalated_tags')
  })

  it('prefixes table names with configured prefix', () => {
    globalThis.__escalated_config = { tablePrefix: 'support_' }
    assert.equal(table('tickets'), 'support_tickets')
    assert.equal(table('replies'), 'support_replies')
  })

  it('handles all known table names with default prefix', () => {
    delete globalThis.__escalated_config
    const knownTables = [
      'tickets',
      'replies',
      'tags',
      'ticket_tag',
      'departments',
      'canned_responses',
      'attachments',
      'activity_logs',
      'sla_policies',
      'escalation_rules',
      'macros',
      'inbound_emails',
      'settings',
    ]

    for (const name of knownTables) {
      const result = table(name)
      assert.equal(result, `escalated_${name}`)
      assert.ok(result.startsWith('escalated_'))
    }
  })

  it('returns the prefix itself when given empty string', () => {
    delete globalThis.__escalated_config
    assert.equal(table(''), 'escalated_')
  })

  it('preserves the table name exactly (no transformation)', () => {
    delete globalThis.__escalated_config
    assert.equal(table('MyTable'), 'escalated_MyTable')
    assert.equal(table('TICKETS'), 'escalated_TICKETS')
  })

  it('concatenates prefix and name via template literal', () => {
    globalThis.__escalated_config = { tablePrefix: 'a_' }
    assert.equal(table('b'), 'a_b')
  })

  it('works with no underscore in prefix', () => {
    globalThis.__escalated_config = { tablePrefix: 'app' }
    assert.equal(table('tickets'), 'apptickets')
  })

  it('works with multiple underscores in prefix', () => {
    globalThis.__escalated_config = { tablePrefix: 'my_app_support_' }
    assert.equal(table('tickets'), 'my_app_support_tickets')
  })
})

describe('Config structure validation', () => {
  let originalConfig

  beforeEach(() => {
    originalConfig = globalThis.__escalated_config
  })

  afterEach(() => {
    globalThis.__escalated_config = originalConfig
  })

  it('supports full config structure', () => {
    const fullConfig = {
      mode: 'self-hosted',
      userModel: '#models/user',
      hosted: {
        apiUrl: 'https://api.escalated.dev',
        apiKey: 'test-key',
      },
      routes: {
        enabled: true,
        prefix: 'support',
        middleware: ['auth'],
        adminMiddleware: ['auth', 'admin'],
      },
      tablePrefix: 'esc_',
      tickets: {
        allowCustomerClose: false,
        autoCloseResolvedAfterDays: 7,
        maxAttachmentsPerReply: 5,
        maxAttachmentSizeKb: 10240,
      },
      priorities: ['low', 'medium', 'high', 'urgent', 'critical'],
      defaultPriority: 'medium',
      statuses: ['open', 'in_progress', 'waiting_on_customer', 'waiting_on_agent', 'escalated', 'resolved', 'closed', 'reopened'],
      sla: {
        enabled: false,
        businessHoursOnly: false,
        businessHours: {
          start: '09:00',
          end: '17:00',
          timezone: 'UTC',
          days: [1, 2, 3, 4, 5],
        },
      },
      notifications: {
        channels: ['mail'],
      },
      storage: {
        disk: 'public',
        path: 'escalated/attachments',
      },
      authorization: {
        isAgent: () => false,
        isAdmin: () => false,
      },
      activityLog: {
        retentionDays: 90,
      },
      inboundEmail: {
        enabled: false,
        adapter: 'mailgun',
        address: 'support@example.com',
        mailgun: {},
        postmark: {},
        ses: { region: 'us-east-1' },
        imap: {
          port: 993,
          encryption: 'tls',
          mailbox: 'INBOX',
        },
      },
    }

    globalThis.__escalated_config = fullConfig
    const config = getConfig()
    assert.equal(config.mode, 'self-hosted')
    assert.equal(config.tablePrefix, 'esc_')
    assert.equal(config.defaultPriority, 'medium')
    assert.equal(config.tickets.maxAttachmentsPerReply, 5)
    assert.equal(config.sla.businessHours.timezone, 'UTC')
    assert.equal(table('tickets'), 'esc_tickets')
  })

  it('supports all three mode options', () => {
    const modes = ['self-hosted', 'synced', 'cloud']
    for (const mode of modes) {
      globalThis.__escalated_config = { mode }
      assert.equal(getConfig().mode, mode)
    }
  })

  it('reads nested config correctly', () => {
    globalThis.__escalated_config = {
      tickets: { maxAttachmentSizeKb: 5120 },
      storage: { disk: 's3', path: 'uploads/support' },
    }
    const config = getConfig()
    assert.equal(config.tickets.maxAttachmentSizeKb, 5120)
    assert.equal(config.storage.disk, 's3')
    assert.equal(config.storage.path, 'uploads/support')
  })
})
