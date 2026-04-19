import type { HttpContext } from '@adonisjs/core/http'
import CannedResponse from '../models/canned_response.js'
import { getRenderer } from '../rendering/renderer.js'
import { t } from '../support/i18n.js'
import { requireAuthUser } from '../support/auth_user.js'

export default class AdminCannedResponsesController {
  async index(ctx: HttpContext) {
    const responses = await CannedResponse.query()
    return getRenderer().render(ctx, 'Escalated/Admin/CannedResponses/Index', { responses })
  }

  async store({ request, auth, response, session }: HttpContext) {
    const data = request.only(['title', 'body', 'category', 'is_shared'])

    await CannedResponse.create({
      title: data.title,
      body: data.body,
      category: data.category || null,
      isShared: data.is_shared !== false,
      createdBy: requireAuthUser(auth).id,
    })

    session.flash('success', t('admin.canned_response_created'))
    return response.redirect().back()
  }

  async update({ params, request, response, session }: HttpContext) {
    const cannedResponse = await CannedResponse.findOrFail(params.cannedResponse || params.id)
    const data = request.only(['title', 'body', 'category', 'is_shared'])

    cannedResponse.merge({
      title: data.title,
      body: data.body,
      category: data.category || null,
      isShared: data.is_shared !== false,
    })
    await cannedResponse.save()

    session.flash('success', t('admin.canned_response_updated'))
    return response.redirect().back()
  }

  async destroy({ params, response, session }: HttpContext) {
    const cannedResponse = await CannedResponse.findOrFail(params.cannedResponse || params.id)
    await cannedResponse.delete()
    session.flash('success', t('admin.canned_response_deleted'))
    return response.redirect().back()
  }
}
