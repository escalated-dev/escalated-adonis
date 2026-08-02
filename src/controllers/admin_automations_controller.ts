import type { HttpContext } from '@adonisjs/core/http'
import Automation from '../models/automation.js'
import AuditService from '../services/audit_service.js'
import { AUDIT_ACTIONS } from '../support/audit_events.js'
import { getRenderer } from '../rendering/renderer.js'
import { t } from '../support/i18n.js'

export default class AdminAutomationsController {
  async index(ctx: HttpContext) {
    const automations = await Automation.query().orderBy('position')
    return getRenderer().render(ctx, 'Escalated/Admin/Automations/Index', { automations })
  }

  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Automations/Form')
  }

  async store({ auth, request, response, session }: HttpContext) {
    const data = request.only(['name', 'conditions', 'actions', 'active'])

    const maxPosition = await Automation.query().max('position as max_position').first()
    const nextPosition = ((maxPosition as any)?.$extras?.max_position ?? 0) + 1

    const automation = await Automation.create({
      name: data.name,
      conditions: data.conditions,
      actions: data.actions,
      active: data.active !== false,
      position: nextPosition,
    })

    await AuditService.fromContext({ auth, request }, AUDIT_ACTIONS.AUTOMATION_CREATED, {
      auditableType: 'Automation',
      auditableId: automation.id,
      newValues: { name: automation.name, active: automation.active },
    })

    session.flash('success', t('admin.automation_created'))
    return response.redirect().back()
  }

  async edit(ctx: HttpContext) {
    const automation = await Automation.findOrFail(ctx.params.id)
    return getRenderer().render(ctx, 'Escalated/Admin/Automations/Form', { automation })
  }

  async update({ auth, params, request, response, session }: HttpContext) {
    const automation = await Automation.findOrFail(params.id)
    const data = request.only(['name', 'conditions', 'actions', 'active'])

    const before = { name: automation.name, active: automation.active }

    automation.merge({
      name: data.name,
      conditions: data.conditions,
      actions: data.actions,
      active: data.active !== false,
    })
    await automation.save()

    await AuditService.fromContext({ auth, request }, AUDIT_ACTIONS.AUTOMATION_UPDATED, {
      auditableType: 'Automation',
      auditableId: automation.id,
      oldValues: before,
      newValues: { name: automation.name, active: automation.active },
    })

    session.flash('success', t('admin.automation_updated'))
    return response.redirect().back()
  }

  async destroy({ auth, params, request, response, session }: HttpContext) {
    const automation = await Automation.findOrFail(params.id)
    const snapshot = { name: automation.name, active: automation.active }
    const automationId = automation.id
    await automation.delete()

    await AuditService.fromContext({ auth, request }, AUDIT_ACTIONS.AUTOMATION_DELETED, {
      auditableType: 'Automation',
      auditableId: automationId,
      oldValues: snapshot,
    })

    session.flash('success', t('admin.automation_deleted'))
    return response.redirect().back()
  }
}
