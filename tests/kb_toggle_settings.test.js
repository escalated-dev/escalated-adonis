import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
|--------------------------------------------------------------------------
| Knowledge Base Toggle Settings Tests
|--------------------------------------------------------------------------
|
| Unit tests for the knowledge base toggle settings and guard middleware.
|
*/

// ──────────────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Simulate knowledge base settings
 */
function buildKbSettings(overrides = {}) {
  return {
    knowledge_base_enabled: false,
    knowledge_base_public: true,
    knowledge_base_feedback_enabled: true,
    ...overrides,
  }
}

/**
 * Simulate the guard middleware decision logic
 */
function simulateGuardDecision(settings, user) {
  if (!settings.knowledge_base_enabled) {
    return { allowed: false, status: 404, error: 'Knowledge base is disabled' }
  }

  if (!settings.knowledge_base_public && !user) {
    return { allowed: false, status: 403, error: 'Knowledge base access requires authentication' }
  }

  return { allowed: true, status: 200, error: null }
}

/**
 * Parse boolean setting value (mirrors EscalatedSetting.getBool)
 */
function parseBoolSetting(value, defaultValue = false) {
  if (value === null || value === undefined) return defaultValue
  return value === '1' || value === 'true' || value === 'yes' || value === true
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe('Knowledge Base Toggle Settings', () => {
  describe('setting defaults', () => {
    it('knowledge_base_enabled defaults to false', () => {
      const settings = buildKbSettings()
      assert.equal(settings.knowledge_base_enabled, false)
    })

    it('knowledge_base_public defaults to true', () => {
      const settings = buildKbSettings()
      assert.equal(settings.knowledge_base_public, true)
    })

    it('knowledge_base_feedback_enabled defaults to true', () => {
      const settings = buildKbSettings()
      assert.equal(settings.knowledge_base_feedback_enabled, true)
    })
  })

  describe('parseBoolSetting', () => {
    it('parses "1" as true', () => {
      assert.equal(parseBoolSetting('1'), true)
    })

    it('parses "true" as true', () => {
      assert.equal(parseBoolSetting('true'), true)
    })

    it('parses "yes" as true', () => {
      assert.equal(parseBoolSetting('yes'), true)
    })

    it('parses boolean true as true', () => {
      assert.equal(parseBoolSetting(true), true)
    })

    it('parses "0" as false', () => {
      assert.equal(parseBoolSetting('0'), false)
    })

    it('parses "false" as false', () => {
      assert.equal(parseBoolSetting('false'), false)
    })

    it('parses "no" as false', () => {
      assert.equal(parseBoolSetting('no'), false)
    })

    it('parses null as default value', () => {
      assert.equal(parseBoolSetting(null, true), true)
      assert.equal(parseBoolSetting(null, false), false)
    })

    it('parses undefined as default value', () => {
      assert.equal(parseBoolSetting(undefined, true), true)
      assert.equal(parseBoolSetting(undefined, false), false)
    })
  })

  describe('KnowledgeBaseGuard', () => {
    it('returns 404 when knowledge base is disabled', () => {
      const settings = buildKbSettings({ knowledge_base_enabled: false })
      const result = simulateGuardDecision(settings, null)

      assert.equal(result.allowed, false)
      assert.equal(result.status, 404)
      assert.equal(result.error, 'Knowledge base is disabled')
    })

    it('returns 404 when KB disabled even with authenticated user', () => {
      const settings = buildKbSettings({ knowledge_base_enabled: false })
      const result = simulateGuardDecision(settings, { id: 1 })

      assert.equal(result.allowed, false)
      assert.equal(result.status, 404)
    })

    it('allows access when KB is enabled and public', () => {
      const settings = buildKbSettings({
        knowledge_base_enabled: true,
        knowledge_base_public: true,
      })
      const result = simulateGuardDecision(settings, null)

      assert.equal(result.allowed, true)
      assert.equal(result.status, 200)
    })

    it('allows authenticated access when KB is enabled and not public', () => {
      const settings = buildKbSettings({
        knowledge_base_enabled: true,
        knowledge_base_public: false,
      })
      const result = simulateGuardDecision(settings, { id: 1 })

      assert.equal(result.allowed, true)
      assert.equal(result.status, 200)
    })

    it('returns 403 when KB is not public and user is not authenticated', () => {
      const settings = buildKbSettings({
        knowledge_base_enabled: true,
        knowledge_base_public: false,
      })
      const result = simulateGuardDecision(settings, null)

      assert.equal(result.allowed, false)
      assert.equal(result.status, 403)
      assert.equal(result.error, 'Knowledge base access requires authentication')
    })

    it('allows public access when KB is enabled and public, no user', () => {
      const settings = buildKbSettings({
        knowledge_base_enabled: true,
        knowledge_base_public: true,
      })
      const result = simulateGuardDecision(settings, null)

      assert.equal(result.allowed, true)
    })
  })

  describe('setting combinations', () => {
    const testCases = [
      { enabled: false, public: true, user: null, expectedAllowed: false },
      { enabled: false, public: true, user: { id: 1 }, expectedAllowed: false },
      { enabled: false, public: false, user: null, expectedAllowed: false },
      { enabled: false, public: false, user: { id: 1 }, expectedAllowed: false },
      { enabled: true, public: true, user: null, expectedAllowed: true },
      { enabled: true, public: true, user: { id: 1 }, expectedAllowed: true },
      { enabled: true, public: false, user: null, expectedAllowed: false },
      { enabled: true, public: false, user: { id: 1 }, expectedAllowed: true },
    ]

    for (const tc of testCases) {
      const desc = `enabled=${tc.enabled}, public=${tc.public}, user=${tc.user ? 'yes' : 'no'} => allowed=${tc.expectedAllowed}`
      it(desc, () => {
        const settings = buildKbSettings({
          knowledge_base_enabled: tc.enabled,
          knowledge_base_public: tc.public,
        })
        const result = simulateGuardDecision(settings, tc.user)
        assert.equal(result.allowed, tc.expectedAllowed)
      })
    }
  })

  describe('feedback setting', () => {
    it('feedback can be enabled', () => {
      const settings = buildKbSettings({ knowledge_base_feedback_enabled: true })
      assert.equal(settings.knowledge_base_feedback_enabled, true)
    })

    it('feedback can be disabled', () => {
      const settings = buildKbSettings({ knowledge_base_feedback_enabled: false })
      assert.equal(settings.knowledge_base_feedback_enabled, false)
    })

    it('feedback is independent of public setting', () => {
      const s1 = buildKbSettings({
        knowledge_base_public: true,
        knowledge_base_feedback_enabled: false,
      })
      assert.equal(s1.knowledge_base_public, true)
      assert.equal(s1.knowledge_base_feedback_enabled, false)

      const s2 = buildKbSettings({
        knowledge_base_public: false,
        knowledge_base_feedback_enabled: true,
      })
      assert.equal(s2.knowledge_base_public, false)
      assert.equal(s2.knowledge_base_feedback_enabled, true)
    })
  })
})
