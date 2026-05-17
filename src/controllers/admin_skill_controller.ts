import type { HttpContext } from '@adonisjs/core/http'
import SkillService from '../services/skill_service.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'
import { t } from '../support/i18n.js'
import { createSkillValidator } from '../validators/admin/create_skill_validator.js'
import { updateSkillValidator } from '../validators/admin/update_skill_validator.js'

export default class AdminSkillController {
  protected service = new SkillService()

  async index(ctx: HttpContext) {
    const skills = await this.service.listForAdmin()
    return getRenderer().render(ctx, 'Escalated/Admin/Skills/Index', { skills })
  }

  async create(ctx: HttpContext) {
    const form = await this.service.getFormContext()
    return getRenderer().render(ctx, 'Escalated/Admin/Skills/Form', {
      skill: null,
      ...form,
    })
  }

  async store({ request, response, session }: HttpContext) {
    const validated = await createSkillValidator(request.all() as Record<string, unknown>)
    if (!validated.ok) {
      session.flash('error', validated.message)
      return response.redirect().back()
    }
    await this.service.create(validated.data)
    session.flash('success', t('admin.skill_created'))
    return redirectToRoute(response, 'escalated.admin.skills.index')
  }

  async edit(ctx: HttpContext) {
    const id = Number(ctx.params.id)
    const [skill, form] = await Promise.all([
      this.service.findForEdit(id),
      this.service.getFormContext(),
    ])
    if (!skill) {
      ctx.session.flash('error', t('admin.skill_not_found'))
      return redirectToRoute(ctx.response, 'escalated.admin.skills.index')
    }
    return getRenderer().render(ctx, 'Escalated/Admin/Skills/Form', {
      skill,
      ...form,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const id = Number(params.id)
    const validated = await updateSkillValidator(id, request.all() as Record<string, unknown>)
    if (!validated.ok) {
      session.flash('error', validated.message)
      return response.redirect().back()
    }
    const skill = await this.service.update(id, validated.data)
    if (!skill) {
      session.flash('error', t('admin.skill_not_found'))
      return redirectToRoute(response, 'escalated.admin.skills.index')
    }
    session.flash('success', t('admin.skill_updated'))
    return redirectToRoute(response, 'escalated.admin.skills.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const id = Number(params.id)
    const ok = await this.service.delete(id)
    if (!ok) {
      session.flash('error', t('admin.skill_not_found'))
      return redirectToRoute(response, 'escalated.admin.skills.index')
    }
    session.flash('success', t('admin.skill_deleted'))
    return redirectToRoute(response, 'escalated.admin.skills.index')
  }
}
