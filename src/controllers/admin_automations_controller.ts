import type { HttpContext } from '@adonisjs/core/http'
import Automation from '../models/automation.js'
import { t } from '../support/i18n.js'

export default class AdminAutomationsController {
  async index({ inertia }: HttpContext) {
    const automations = await Automation.query().orderBy('position')
    return inertia.render('Escalated/Admin/Automations/Index', { automations })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('Escalated/Admin/Automations/Form')
  }

  async store({ request, response, session }: HttpContext) {
    const data = request.only(['name', 'conditions', 'actions', 'active'])

    const maxPosition = await Automation.query().max('position as max_position').first()
    const nextPosition = ((maxPosition as any)?.$extras?.max_position ?? 0) + 1

    await Automation.create({
      name: data.name,
      conditions: data.conditions,
      actions: data.actions,
      active: data.active !== false,
      position: nextPosition,
    })

    session.flash('success', t('admin.automation_created'))
    return response.redirect().back()
  }

  async edit({ params, inertia }: HttpContext) {
    const automation = await Automation.findOrFail(params.id)
    return inertia.render('Escalated/Admin/Automations/Form', { automation })
  }

  async update({ params, request, response, session }: HttpContext) {
    const automation = await Automation.findOrFail(params.id)
    const data = request.only(['name', 'conditions', 'actions', 'active'])

    automation.merge({
      name: data.name,
      conditions: data.conditions,
      actions: data.actions,
      active: data.active !== false,
    })
    await automation.save()

    session.flash('success', t('admin.automation_updated'))
    return response.redirect().back()
  }

  async destroy({ params, response, session }: HttpContext) {
    const automation = await Automation.findOrFail(params.id)
    await automation.delete()
    session.flash('success', t('admin.automation_deleted'))
    return response.redirect().back()
  }
}
