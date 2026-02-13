import type { HttpContext } from '@adonisjs/core/http'
import Macro from '../models/macro.js'
import { t } from '../support/i18n.js'

export default class AdminMacrosController {
  async index({ inertia }: HttpContext) {
    const macros = await Macro.query().orderBy('order')
    return inertia.render('Escalated/Admin/Macros/Index', { macros })
  }

  async store({ request, auth, response, session }: HttpContext) {
    const data = request.only(['name', 'description', 'actions', 'is_shared', 'order'])

    await Macro.create({
      name: data.name,
      description: data.description || null,
      actions: data.actions,
      isShared: data.is_shared !== false,
      order: data.order || 0,
      createdBy: auth.user!.id,
    })

    session.flash('success', t('admin.macro_created'))
    return response.redirect().back()
  }

  async update({ params, request, response, session }: HttpContext) {
    const macro = await Macro.findOrFail(params.macro || params.id)
    const data = request.only(['name', 'description', 'actions', 'is_shared', 'order'])

    macro.merge({
      name: data.name,
      description: data.description || null,
      actions: data.actions,
      isShared: data.is_shared !== false,
      order: data.order || 0,
    })
    await macro.save()

    session.flash('success', t('admin.macro_updated'))
    return response.redirect().back()
  }

  async destroy({ params, response, session }: HttpContext) {
    const macro = await Macro.findOrFail(params.macro || params.id)
    await macro.delete()
    session.flash('success', t('admin.macro_deleted'))
    return response.redirect().back()
  }
}
