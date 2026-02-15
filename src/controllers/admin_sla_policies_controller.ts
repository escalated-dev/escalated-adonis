import type { HttpContext } from '@adonisjs/core/http'
import SlaPolicy from '../models/sla_policy.js'
import { getConfig } from '../helpers/config.js'
import { t } from '../support/i18n.js'

export default class AdminSlaPoliciesController {
  async index({ inertia }: HttpContext) {
    const policies = await SlaPolicy.query().withCount('tickets')
    return inertia.render('Escalated/Admin/SlaPolicies/Index', { policies })
  }

  async create({ inertia }: HttpContext) {
    const config = getConfig()
    return inertia.render('Escalated/Admin/SlaPolicies/Form', {
      priorities: config.priorities,
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = request.only([
      'name', 'description', 'is_default',
      'first_response_hours', 'resolution_hours',
      'business_hours_only', 'is_active',
    ])

    await SlaPolicy.create({
      name: data.name,
      description: data.description || null,
      isDefault: data.is_default || false,
      firstResponseHours: data.first_response_hours,
      resolutionHours: data.resolution_hours,
      businessHoursOnly: data.business_hours_only || false,
      isActive: data.is_active !== false,
    })

    session.flash('success', t('admin.sla_policy_created'))
    return response.redirect().toRoute('escalated.admin.sla-policies.index')
  }

  async edit({ params, inertia }: HttpContext) {
    const config = getConfig()
    const policy = await SlaPolicy.findOrFail(params.id)
    return inertia.render('Escalated/Admin/SlaPolicies/Form', {
      policy,
      priorities: config.priorities,
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const policy = await SlaPolicy.findOrFail(params.id)
    const data = request.only([
      'name', 'description', 'is_default',
      'first_response_hours', 'resolution_hours',
      'business_hours_only', 'is_active',
    ])

    policy.merge({
      name: data.name,
      description: data.description || null,
      isDefault: data.is_default || false,
      firstResponseHours: data.first_response_hours,
      resolutionHours: data.resolution_hours,
      businessHoursOnly: data.business_hours_only || false,
      isActive: data.is_active !== false,
    })
    await policy.save()

    session.flash('success', t('admin.sla_policy_updated'))
    return response.redirect().toRoute('escalated.admin.sla-policies.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const policy = await SlaPolicy.findOrFail(params.id)
    await policy.delete()
    session.flash('success', t('admin.sla_policy_deleted'))
    return response.redirect().toRoute('escalated.admin.sla-policies.index')
  }
}
