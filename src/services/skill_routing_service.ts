import db from '@adonisjs/lucid/services/db'
import type Ticket from '../models/ticket.js'
import type { UserId } from '../helpers/user_id_column.js'

function compareUserId(a: UserId, b: UserId): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/**
 * Pure ADR routing step 1: union of skills matched by explicit tag edges
 * or explicit department edges.
 */
export function explicitRequiredSkillIds(
  ticketTagIds: number[],
  ticketDepartmentId: number | null,
  tagEdges: { skillId: number; tagId: number }[],
  deptEdges: { skillId: number; departmentId: number }[]
): number[] {
  const tagSet = new Set(
    (ticketTagIds ?? []).filter((id) => Number.isFinite(id) && id > 0).map((id) => Number(id))
  )
  const required = new Set<number>()
  for (const e of tagEdges) {
    if (tagSet.has(e.tagId)) required.add(e.skillId)
  }
  if (Number.isFinite(Number(ticketDepartmentId)) && Number(ticketDepartmentId) > 0) {
    const d = Number(ticketDepartmentId)
    for (const e of deptEdges) {
      if (e.departmentId === d) required.add(e.skillId)
    }
  }
  return [...required].sort((a, b) => a - b)
}

/**
 * Pure ADR routing step 2–3: users who have every required skill, ordered
 * by total proficiency desc then user id asc.
 */
export function orderAgentsByProficiency(
  requiredSkillIds: number[],
  assignments: { userId: UserId; skillId: number; proficiency: number }[]
): UserId[] {
  const needed = new Set(requiredSkillIds.map((id) => Number(id)))
  if (needed.size === 0) return []

  const byUser = new Map<UserId, Map<number, number>>()
  for (const a of assignments) {
    if (!needed.has(a.skillId)) continue
    if (!byUser.has(a.userId)) byUser.set(a.userId, new Map())
    byUser.get(a.userId)!.set(a.skillId, a.proficiency)
  }

  const eligible: { userId: UserId; sum: number }[] = []
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

  eligible.sort((a, b) => b.sum - a.sum || compareUserId(a.userId, b.userId))
  return eligible.map((e) => e.userId)
}

/**
 * Explicit tag/department → skill routing (ADR 2026-05-13).
 *
 * `findMatchingAgents` returns host User ids that have **all** required
 * skills, ordered by sum of proficiency (desc), then user id (asc) as a
 * stable tie-break when ticket-load data is unavailable here.
 */
export default class SkillRoutingService {
  /**
   * Resolve required skill ids for a ticket from routing-tag overlap and
   * routing-department hits (union). Exposed for unit tests.
   */
  static async requiredSkillIdsForTicket(
    ticketTagIds: number[],
    ticketDepartmentId: number | null
  ): Promise<number[]> {
    const tagSet = new Set(
      (ticketTagIds ?? []).filter((id) => Number.isFinite(id) && id > 0).map((id) => Number(id))
    )
    const required = new Set<number>()

    if (tagSet.size > 0) {
      const rows = await db
        .from('escalated_skill_routing_tags')
        .whereIn('tag_id', [...tagSet])
        .select('skill_id')
      for (const r of rows) {
        required.add(Number(r.skill_id))
      }
    }

    if (Number.isFinite(Number(ticketDepartmentId)) && Number(ticketDepartmentId) > 0) {
      const deptId = Number(ticketDepartmentId)
      const rows = await db
        .from('escalated_skill_routing_departments')
        .where('department_id', deptId)
        .select('skill_id')
      for (const r of rows) {
        required.add(Number(r.skill_id))
      }
    }

    return [...required].sort((a, b) => a - b)
  }

  static async findMatchingAgents(ticket: Ticket): Promise<UserId[]> {
    await ticket.load('tags')
    const tagIds = ticket.tags.map((t) => t.id)
    const deptId = ticket.departmentId
    const requiredSkillIds = await this.requiredSkillIdsForTicket(tagIds, deptId)

    if (requiredSkillIds.length === 0) {
      return []
    }

    const rows = await db
      .from('escalated_agent_skills')
      .whereIn('skill_id', requiredSkillIds)
      .select('user_id', 'skill_id', 'proficiency')

    const assignments = rows.map((r: any) => ({
      userId: r.user_id as UserId,
      skillId: Number(r.skill_id),
      proficiency: Number(r.proficiency),
    }))

    return orderAgentsByProficiency(requiredSkillIds, assignments)
  }
}
