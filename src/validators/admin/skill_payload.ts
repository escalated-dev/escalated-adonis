import Tag from '../../models/tag.js'
import Department from '../../models/department.js'
import Skill from '../../models/skill.js'
import type { SkillStorePayload } from '../../services/skill_service.js'
import type { UserId } from '../../helpers/user_id_column.js'

export type SkillPayloadResult =
  { ok: true; data: SkillStorePayload } | { ok: false; message: string }

function asUniquePositiveInts(value: unknown): number[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return []
  const out = new Set<number>()
  for (const item of value) {
    const n = Number(item)
    if (Number.isFinite(n) && n > 0) out.add(Math.trunc(n))
  }
  return [...out]
}

function parseHostUserId(raw: unknown): UserId | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw
  }
  return null
}

function parseAgentRows(value: unknown): { user_id: UserId; proficiency: number }[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) return null
  const rows: { user_id: UserId; proficiency: number }[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const uid = parseHostUserId(rec.user_id ?? rec.userId)
    if (uid === null) continue
    let prof = 3
    if (rec.proficiency !== undefined && rec.proficiency !== null) {
      prof = Number(rec.proficiency)
    }
    if (!Number.isFinite(prof) || prof < 1 || prof > 5) {
      return null
    }
    rows.push({ user_id: uid, proficiency: Math.trunc(prof) })
  }
  return rows
}

async function loadUserModel(): Promise<any> {
  const config = (globalThis as any).__escalated_config
  const userModelPath = config?.userModel ?? '#models/user'
  const mod: any = await import(userModelPath)
  return mod.default
}

async function userIsEligibleAgent(userId: UserId): Promise<boolean> {
  const UserModel = await loadUserModel()
  const user = await UserModel.find(userId)
  if (!user) return false
  const isAdmin = Boolean(user.isAdmin ?? user.is_admin ?? false)
  const isAgent = Boolean(user.isAgent ?? user.is_agent ?? false)
  return isAdmin || isAgent
}

export async function validateSkillStorePayload(
  input: Record<string, unknown>,
  options: { excludeSkillId?: number } = {}
): Promise<SkillPayloadResult> {
  const nameRaw = input.name
  if (typeof nameRaw !== 'string' || !nameRaw.trim()) {
    return { ok: false, message: 'Name is required.' }
  }
  const name = nameRaw.trim()
  if (name.length > 100) {
    return { ok: false, message: 'Name must be at most 100 characters.' }
  }

  const dupQuery = Skill.query().whereRaw('lower(name) = ?', [name.toLowerCase()])
  if (options.excludeSkillId !== undefined && options.excludeSkillId !== null) {
    dupQuery.whereNot('id', options.excludeSkillId)
  }
  const dup = await dupQuery.first()
  if (dup) {
    return { ok: false, message: 'A skill with this name already exists.' }
  }

  const routingTagIds = asUniquePositiveInts(input.routing_tag_ids ?? input.routingTagIds)
  const routingDepartmentIds = asUniquePositiveInts(
    input.routing_department_ids ?? input.routingDepartmentIds
  )

  if (routingTagIds.length) {
    const tags = await Tag.query().whereIn('id', routingTagIds)
    if (tags.length !== routingTagIds.length) {
      return { ok: false, message: 'One or more routing tags do not exist.' }
    }
  }

  if (routingDepartmentIds.length) {
    const departments = await Department.query().whereIn('id', routingDepartmentIds)
    if (departments.length !== routingDepartmentIds.length) {
      return { ok: false, message: 'One or more routing departments do not exist.' }
    }
  }

  if (input.agents !== undefined && input.agents !== null && !Array.isArray(input.agents)) {
    return { ok: false, message: 'Agents must be an array.' }
  }

  const agentsRaw = parseAgentRows(input.agents)
  if (agentsRaw === null) {
    return { ok: false, message: 'Each proficiency must be between 1 and 5.' }
  }

  const seenUsers = new Set<string>()
  for (const row of agentsRaw) {
    const userKey = String(row.user_id)
    if (seenUsers.has(userKey)) {
      return { ok: false, message: 'Duplicate agent entries are not allowed.' }
    }
    seenUsers.add(userKey)
    if (!(await userIsEligibleAgent(row.user_id))) {
      return {
        ok: false,
        message: `User #${row.user_id} is not an eligible agent (must be an agent or admin).`,
      }
    }
  }

  const description =
    input.description === undefined || input.description === null ? null : String(input.description)

  const slugRaw = input.slug
  const slug =
    slugRaw === undefined || slugRaw === null || String(slugRaw).trim() === ''
      ? null
      : String(slugRaw).trim()
  if (slug && slug.length > 100) {
    return { ok: false, message: 'Slug must be at most 100 characters.' }
  }

  const data: SkillStorePayload = {
    name,
    slug,
    description,
    routing_tag_ids: routingTagIds,
    routing_department_ids: routingDepartmentIds,
    agents: agentsRaw,
  }

  return { ok: true, data }
}
