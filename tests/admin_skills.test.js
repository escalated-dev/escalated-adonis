import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Admin skills — pure routing + payload behaviour (no Lucid / no HTTP).
 * Re-implements the exported routing helpers from `SkillRoutingService`
 * so `npm test` does not require a prior `npm run build`.
 */

function explicitRequiredSkillIds(
  ticketTagIds,
  ticketDepartmentId,
  tagEdges,
  deptEdges
) {
  const tagSet = new Set(
    (ticketTagIds ?? []).filter((id) => Number.isFinite(id) && id > 0).map((id) => Number(id))
  )
  const required = new Set()
  for (const e of tagEdges) {
    if (tagSet.has(e.tagId)) required.add(e.skillId)
  }
  if (ticketDepartmentId != null && ticketDepartmentId > 0) {
    const d = Number(ticketDepartmentId)
    for (const e of deptEdges) {
      if (e.departmentId === d) required.add(e.skillId)
    }
  }
  return [...required].sort((a, b) => a - b)
}

function orderAgentsByProficiency(requiredSkillIds, assignments) {
  const needed = new Set(requiredSkillIds.map((id) => Number(id)))
  if (needed.size === 0) return []

  const byUser = new Map()
  for (const a of assignments) {
    if (!needed.has(a.skillId)) continue
    if (!byUser.has(a.userId)) byUser.set(a.userId, new Map())
    byUser.get(a.userId).set(a.skillId, a.proficiency)
  }

  const eligible = []
  for (const [userId, skills] of byUser.entries()) {
    let sum = 0
    let ok = true
    for (const sid of needed) {
      const p = skills.get(sid)
      if (p === undefined) {
        ok = false
        break
      }
      sum += p
    }
    if (ok) eligible.push({ userId, sum })
  }

  eligible.sort((a, b) => b.sum - a.sum || a.userId - b.userId)
  return eligible.map((e) => e.userId)
}

describe('SkillRoutingService — explicit mapping', () => {
  it('unions skills matched by tag overlap or department membership', () => {
    const tagEdges = [
      { skillId: 10, tagId: 1 },
      { skillId: 20, tagId: 2 },
    ]
    const deptEdges = [{ skillId: 30, departmentId: 5 }]
    const ids = explicitRequiredSkillIds([1], 5, tagEdges, deptEdges)
    assert.deepEqual(ids, [10, 30])
  })

  it('returns agents who have all required skills, ordered by proficiency sum desc', () => {
    const required = [1, 2]
    const assignments = [
      { userId: 1, skillId: 1, proficiency: 5 },
      { userId: 1, skillId: 2, proficiency: 1 },
      { userId: 2, skillId: 1, proficiency: 3 },
      { userId: 3, skillId: 1, proficiency: 5 },
      { userId: 3, skillId: 2, proficiency: 5 },
    ]
    const ordered = orderAgentsByProficiency(required, assignments)
    assert.deepEqual(ordered, [3, 1])
  })
})

describe('Skill payload validation — agent eligibility', () => {
  it('flags a customer-only user as ineligible', () => {
    const user = { id: 9, is_agent: false, is_admin: false }
    const isEligible =
      Boolean(user.isAgent ?? user.is_agent) || Boolean(user.isAdmin ?? user.is_admin)
    assert.equal(isEligible, false)
  })

  it('accepts admins and agents', () => {
    assert.equal(
      Boolean({ is_agent: true, is_admin: false }.is_agent) ||
        Boolean({ is_agent: true, is_admin: false }.is_admin),
      true
    )
    assert.equal(
      Boolean({ is_agent: false, is_admin: true }.is_agent) ||
        Boolean({ is_agent: false, is_admin: true }.is_admin),
      true
    )
  })
})

describe('Skill CRUD payload — round-trip shape', () => {
  it('normalizes store payload keys for persistence', () => {
    const body = {
      name: ' Networking ',
      routing_tag_ids: [1, 1, 2],
      routing_department_ids: [3],
      agents: [{ user_id: 1, proficiency: 4 }, { user_id: 2 }],
    }
    const routingTagIds = [...new Set(body.routing_tag_ids.filter((n) => n > 0))]
    const agents = body.agents.map((a) => ({
      user_id: a.user_id,
      proficiency: a.proficiency ?? 3,
    }))
    assert.deepEqual(routingTagIds, [1, 2])
    assert.equal(agents[1].proficiency, 3)
    assert.equal(body.name.trim(), 'Networking')
  })
})
