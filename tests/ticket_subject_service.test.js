import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

const SUBJECT_TYPE = 'FakeProject'

function getConfig() {
  return globalThis.__escalated_config ?? {}
}

function ticketSubjectAllowedTypes() {
  const raw = getConfig().ticketSubjects?.types
  if (!raw) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw
  }
  return Object.entries(raw).flatMap(([alias, className]) => [alias, className])
}

class TicketSubjectNotAllowedError extends Error {
  constructor(type) {
    super(`Subject type [${type}] is not an allowed ticket subject.`)
    this.name = 'TicketSubjectNotAllowedError'
  }
}

function assertTicketSubjectTypeAllowed(subjectType) {
  const allowed = ticketSubjectAllowedTypes()
  if (allowed.length > 0 && !allowed.includes(subjectType)) {
    throw new TicketSubjectNotAllowedError(subjectType)
  }
}

function isTicketSubjectPresentable(value) {
  return (
    value !== null && typeof value === 'object' && typeof value.ticketSubjectTitle === 'function'
  )
}

async function serializeLinks(links, resolver) {
  const result = []

  for (const link of links) {
    const resolved = resolver ? await resolver(link.subjectType, link.subjectId) : null
    const presents = isTicketSubjectPresentable(resolved)

    result.push({
      type: link.subjectType,
      id: link.subjectId,
      role: link.role,
      title: presents ? resolved.ticketSubjectTitle() : `${link.subjectType}#${link.subjectId}`,
      subtitle: presents ? resolved.ticketSubjectSubtitle() : null,
      url: presents ? resolved.ticketSubjectUrl() : null,
      color: presents ? resolved.ticketSubjectColor() : null,
      icon: presents ? resolved.ticketSubjectIcon() : null,
      missing: !presents,
    })
  }

  return result
}

class FakePresentable {
  constructor(title, id) {
    this.title = title
    this.id = id
  }

  ticketSubjectTitle() {
    return this.title
  }

  ticketSubjectSubtitle() {
    return 'Project · Acme'
  }

  ticketSubjectUrl() {
    return `https://app.test/projects/${this.id}`
  }

  ticketSubjectColor() {
    return '#2563eb'
  }

  ticketSubjectIcon() {
    return 'folder'
  }
}

describe('ticket_subject_service', () => {
  let savedConfig

  beforeEach(() => {
    savedConfig = globalThis.__escalated_config
  })

  afterEach(() => {
    globalThis.__escalated_config = savedConfig
  })

  describe('ticketSubjectAllowedTypes', () => {
    it('returns an empty list when types are unset', () => {
      globalThis.__escalated_config = { ticketSubjects: {} }
      assert.deepEqual(ticketSubjectAllowedTypes(), [])
    })

    it('flattens alias maps for allowlist checks', () => {
      globalThis.__escalated_config = {
        ticketSubjects: {
          types: {
            project: 'App/Models/Project',
            customer: 'App/Models/Customer',
          },
        },
      }
      assert.deepEqual(ticketSubjectAllowedTypes(), [
        'project',
        'App/Models/Project',
        'customer',
        'App/Models/Customer',
      ])
    })
  })

  describe('assertTicketSubjectTypeAllowed', () => {
    it('rejects types outside the configured allowlist', () => {
      globalThis.__escalated_config = { ticketSubjects: { types: ['OtherType'] } }
      assert.throws(
        () => assertTicketSubjectTypeAllowed(SUBJECT_TYPE),
        TicketSubjectNotAllowedError
      )
    })

    it('allows any type when the allowlist is empty', () => {
      globalThis.__escalated_config = { ticketSubjects: { types: [] } }
      assert.doesNotThrow(() => assertTicketSubjectTypeAllowed(SUBJECT_TYPE))
    })
  })

  describe('serializeLinks', () => {
    it('serializes subjects through a resolver', async () => {
      const resolver = async (_type, id) => new FakePresentable('Acme Redesign', id)
      const serialized = await serializeLinks(
        [{ subjectType: SUBJECT_TYPE, subjectId: '7', role: 'project' }],
        resolver
      )

      assert.equal(serialized.length, 1)
      assert.deepEqual(serialized[0], {
        type: SUBJECT_TYPE,
        id: '7',
        role: 'project',
        title: 'Acme Redesign',
        subtitle: 'Project · Acme',
        url: 'https://app.test/projects/7',
        color: '#2563eb',
        icon: 'folder',
        missing: false,
      })
    })

    it('falls back when the resolver returns null', async () => {
      const serialized = await serializeLinks(
        [{ subjectType: SUBJECT_TYPE, subjectId: '99', role: null }],
        async () => null
      )

      assert.deepEqual(serialized[0], {
        type: SUBJECT_TYPE,
        id: '99',
        role: null,
        title: `${SUBJECT_TYPE}#99`,
        subtitle: null,
        url: null,
        color: null,
        icon: null,
        missing: true,
      })
    })

    it('falls back when no resolver is configured', async () => {
      const serialized = await serializeLinks(
        [{ subjectType: SUBJECT_TYPE, subjectId: '1', role: null }],
        undefined
      )

      assert.equal(serialized[0]?.title, `${SUBJECT_TYPE}#1`)
      assert.equal(serialized[0]?.missing, true)
    })
  })
})
