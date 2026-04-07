import type { HttpContext } from '@adonisjs/core/http'
import EscalationRule from '../models/escalation_rule.js'
import { getRenderer } from '../rendering/renderer.js'
import { t } from '../support/i18n.js'

export default class AdminEscalationRulesController {
  async index(ctx: HttpContext) {
    const rules = await EscalationRule.query().orderBy('order')
    return getRenderer().render(ctx, 'Escalated/Admin/EscalationRules/Index', { rules })
  }

  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/EscalationRules/Form')
  }

  async store({ request, response, session }: HttpContext) {
    const data = request.only([
      'name',
      'description',
      'trigger_type',
      'conditions',
      'actions',
      'order',
      'is_active',
    ])

    await EscalationRule.create({
      name: data.name,
      description: data.description || null,
      triggerType: data.trigger_type,
      conditions: data.conditions,
      actions: data.actions,
      order: data.order || 0,
      isActive: data.is_active !== false,
    })

    session.flash('success', t('admin.rule_created'))
    return response.redirect().toRoute('escalated.admin.escalation-rules.index')
  }

  async edit(ctx: HttpContext) {
    const rule = await EscalationRule.findOrFail(ctx.params.id)
    return getRenderer().render(ctx, 'Escalated/Admin/EscalationRules/Form', { rule })
  }

  async update({ params, request, response, session }: HttpContext) {
    const rule = await EscalationRule.findOrFail(params.id)
    const data = request.only([
      'name',
      'description',
      'trigger_type',
      'conditions',
      'actions',
      'order',
      'is_active',
    ])

    rule.merge({
      name: data.name,
      description: data.description || null,
      triggerType: data.trigger_type,
      conditions: data.conditions,
      actions: data.actions,
      order: data.order || 0,
      isActive: data.is_active !== false,
    })
    await rule.save()

    session.flash('success', t('admin.rule_updated'))
    return response.redirect().toRoute('escalated.admin.escalation-rules.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const rule = await EscalationRule.findOrFail(params.id)
    await rule.delete()
    session.flash('success', t('admin.rule_deleted'))
    return response.redirect().toRoute('escalated.admin.escalation-rules.index')
  }
}
