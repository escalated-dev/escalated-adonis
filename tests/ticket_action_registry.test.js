import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/*
 * Mirrors the resolution semantics of src/services/ticket_action_registry.ts.
 * Following the repo convention (see ticket_snooze.test.js) these tests model
 * the behavior of the registry — value-or-function resolution, visibility
 * filtering, and the disabled flag — independent of the AdonisJS runtime.
 */

function resolve(value, ticket, user) {
  return typeof value === 'function' ? value(ticket, user) : value
}

function forTicket(actions, ticket, user) {
  const result = []
  for (const a of actions) {
    if (!resolve(a.visible ?? true, ticket, user)) continue
    const confirmation = resolve(a.confirmation ?? null, ticket, user)
    result.push({
      key: a.key,
      label: String(resolve(a.label, ticket, user)),
      variant: a.variant ?? 'secondary',
      confirmation:
        confirmation === null || confirmation === undefined ? null : String(confirmation),
      disabled: !resolve(a.enabled ?? true, ticket, user),
      metadata: resolve(a.metadata ?? {}, ticket, user),
    })
  }
  return result
}

describe('TicketActionRegistry semantics', () => {
  const ticket = { id: 1, reference: 'TK-1' }
  const user = { id: 9 }

  it('serializes a config action with sensible defaults', () => {
    const [action] = forTicket([{ key: 'sync-crm', label: 'Sync CRM' }], ticket, user)
    assert.deepEqual(action, {
      key: 'sync-crm',
      label: 'Sync CRM',
      variant: 'secondary',
      confirmation: null,
      disabled: false,
      metadata: {},
    })
  })

  it('omits invisible actions and marks disabled ones', () => {
    const actions = forTicket(
      [
        { key: 'hidden', label: 'Hidden', visible: false },
        { key: 'locked', label: 'Locked', enabled: false },
      ],
      ticket,
      user
    )
    assert.equal(actions.length, 1)
    assert.equal(actions[0].key, 'locked')
    assert.equal(actions[0].disabled, true)
  })

  it('resolves function fields with ticket + user', () => {
    const [action] = forTicket(
      [
        {
          key: 'dyn',
          label: (t) => `Sync ${t.reference}`,
          visible: (_t, u) => u.id === 9,
          metadata: () => ({ icon: 'refresh-cw' }),
        },
      ],
      ticket,
      user
    )
    assert.equal(action.label, 'Sync TK-1')
    assert.deepEqual(action.metadata, { icon: 'refresh-cw' })
  })
})
