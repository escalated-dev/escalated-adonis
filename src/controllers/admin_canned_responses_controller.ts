import type { HttpContext } from '@adonisjs/core/http'
import CannedResponse from '../models/canned_response.js'

export default class AdminCannedResponsesController {
  async index({ inertia }: HttpContext) {
    const responses = await CannedResponse.query()
    return inertia.render('Escalated/Admin/CannedResponses/Index', { responses })
  }

  async store({ request, auth, response, session }: HttpContext) {
    const data = request.only(['title', 'body', 'category', 'is_shared'])

    await CannedResponse.create({
      title: data.title,
      body: data.body,
      category: data.category || null,
      isShared: data.is_shared !== false,
      createdBy: auth.user!.id,
    })

    session.flash('success', 'Canned response created.')
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

    session.flash('success', 'Canned response updated.')
    return response.redirect().back()
  }

  async destroy({ params, response, session }: HttpContext) {
    const cannedResponse = await CannedResponse.findOrFail(params.cannedResponse || params.id)
    await cannedResponse.delete()
    session.flash('success', 'Canned response deleted.')
    return response.redirect().back()
  }
}
