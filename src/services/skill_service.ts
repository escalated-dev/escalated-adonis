import string from '@adonisjs/core/helpers/string'
import db from '@adonisjs/lucid/services/db'
import Skill from '../models/skill.js'
import AgentSkill from '../models/agent_skill.js'
import SkillRoutingTag from '../models/skill_routing_tag.js'
import SkillRoutingDepartment from '../models/skill_routing_department.js'
import Tag from '../models/tag.js'
import Department from '../models/department.js'

export type SkillStorePayload = {
  name: string
  slug?: string | null
  description?: string | null
  routing_tag_ids: number[]
  routing_department_ids: number[]
  agents: { user_id: number; proficiency: number }[]
}

export type SkillListRow = {
  id: number
  name: string
  agents_count: number
  routing_tags_count: number
  routing_departments_count: number
  updated_at: string
}

export type SkillEditShape = {
  id: number
  name: string
  routing_tag_ids: number[]
  routing_department_ids: number[]
  agents: { user_id: number; proficiency: number }[]
}

export type SkillFormContext = {
  available_agents: { id: number; name: string | null; email: string }[]
  available_tags: { id: number; name: string }[]
  available_departments: { id: number; name: string }[]
}

export default class SkillService {
  async listForAdmin(): Promise<SkillListRow[]> {
    const skills = await Skill.query()
      .withCount('agentSkills', (q) => q.as('agents_count'))
      .withCount('skillRoutingTags', (q) => q.as('routing_tags_count'))
      .withCount('skillRoutingDepartments', (q) => q.as('routing_departments_count'))
      .orderBy('name', 'asc')

    return skills.map((s) => ({
      id: s.id,
      name: s.name,
      agents_count: Number((s as any).$extras.agents_count ?? 0),
      routing_tags_count: Number((s as any).$extras.routing_tags_count ?? 0),
      routing_departments_count: Number((s as any).$extras.routing_departments_count ?? 0),
      updated_at: s.updatedAt.toISO() ?? s.updatedAt.toString(),
    }))
  }

  async findForEdit(id: number): Promise<SkillEditShape | null> {
    const skill = await Skill.query()
      .where('id', id)
      .preload('routingTags')
      .preload('routingDepartments')
      .preload('agentSkills')
      .first()

    if (!skill) return null

    return {
      id: skill.id,
      name: skill.name,
      routing_tag_ids: skill.routingTags.map((t) => t.id),
      routing_department_ids: skill.routingDepartments.map((d) => d.id),
      agents: skill.agentSkills.map((a) => ({
        user_id: a.userId,
        proficiency: a.proficiency,
      })),
    }
  }

  async getFormContext(): Promise<SkillFormContext> {
    const UserModel = await this.loadUserModel()
    const [tags, departments, agents] = await Promise.all([
      Tag.query().orderBy('name', 'asc'),
      Department.query().where('is_active', true).orderBy('name', 'asc'),
      UserModel.query()
        .where((q: any) => {
          q.where('is_agent', true).orWhere('is_admin', true)
        })
        .orderBy('id', 'asc'),
    ])

    return {
      available_tags: tags.map((t) => ({ id: t.id, name: t.name })),
      available_departments: departments.map((d) => ({ id: d.id, name: d.name })),
      available_agents: agents.map((u: any) => ({
        id: u.id,
        name: u.name ?? null,
        email: u.email,
      })),
    }
  }

  async create(payload: SkillStorePayload): Promise<Skill> {
    return await db.transaction(async (trx) => {
      const baseSlug = (payload.slug && String(payload.slug).trim()) || string.slug(payload.name)
      const slug = await this.ensureUniqueSlug(trx, baseSlug)

      const skill = new Skill()
      skill.useTransaction(trx)
      skill.name = payload.name.trim()
      skill.slug = slug
      skill.description =
        payload.description === undefined || payload.description === null
          ? null
          : String(payload.description)
      await skill.save()

      await this.syncRoutingAndAgents(trx, skill.id, payload)
      return skill
    })
  }

  async update(id: number, payload: SkillStorePayload): Promise<Skill | null> {
    return await db.transaction(async (trx) => {
      const skill = await Skill.query({ client: trx }).where('id', id).first()
      if (!skill) return null

      skill.useTransaction(trx)
      skill.name = payload.name.trim()
      if (payload.slug && String(payload.slug).trim()) {
        skill.slug = await this.ensureUniqueSlug(trx, String(payload.slug).trim(), id)
      } else {
        skill.slug = await this.ensureUniqueSlug(trx, string.slug(payload.name), id)
      }
      skill.description =
        payload.description === undefined || payload.description === null
          ? null
          : String(payload.description)
      await skill.save()

      await this.syncRoutingAndAgents(trx, id, payload)
      return await Skill.query({ client: trx }).where('id', id).first()
    })
  }

  async delete(id: number): Promise<boolean> {
    const skill = await Skill.find(id)
    if (!skill) return false
    await skill.delete()
    return true
  }

  protected async syncRoutingAndAgents(
    trx: any,
    skillId: number,
    payload: SkillStorePayload
  ): Promise<void> {
    await SkillRoutingTag.query({ client: trx }).where('skillId', skillId).delete()
    await SkillRoutingDepartment.query({ client: trx }).where('skillId', skillId).delete()
    await AgentSkill.query({ client: trx }).where('skillId', skillId).delete()

    const tagRows = payload.routing_tag_ids.map((tagId) => ({
      skillId,
      tagId,
    }))
    if (tagRows.length) {
      await SkillRoutingTag.createMany(tagRows, { client: trx })
    }

    const deptRows = payload.routing_department_ids.map((departmentId) => ({
      skillId,
      departmentId,
    }))
    if (deptRows.length) {
      await SkillRoutingDepartment.createMany(deptRows, { client: trx })
    }

    const agentRows = payload.agents.map((a) => ({
      skillId,
      userId: a.user_id,
      proficiency: a.proficiency,
    }))
    if (agentRows.length) {
      await AgentSkill.createMany(agentRows, { client: trx })
    }
  }

  protected async ensureUniqueSlug(
    trx: any,
    desired: string,
    excludeSkillId?: number
  ): Promise<string> {
    let suffix = 0
    let candidate = desired
    while (suffix < 10_000) {
      const q = Skill.query({ client: trx }).where('slug', candidate)
      if (excludeSkillId !== undefined && excludeSkillId !== null) {
        q.whereNot('id', excludeSkillId)
      }
      const exists = await q.first()
      if (!exists) return candidate
      suffix += 1
      candidate = `${desired}-${suffix}`
    }
    return desired
  }

  protected async loadUserModel(): Promise<any> {
    const config = (globalThis as any).__escalated_config
    const userModelPath = config?.userModel ?? '#models/user'
    const mod: any = await import(userModelPath)
    return mod.default
  }
}
