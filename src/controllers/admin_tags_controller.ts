import type { HttpContext } from '@adonisjs/core/http'
import Tag from '../models/tag.js'

export default class AdminTagsController {
  async index({ inertia }: HttpContext) {
    const tags = await Tag.query().withCount('tickets')
    return inertia.render('Escalated/Admin/Tags/Index', { tags })
  }

  async store({ request, response, session }: HttpContext) {
    const data = request.only(['name', 'slug', 'color'])
    await Tag.create({
      name: data.name,
      slug: data.slug || undefined,
      color: data.color || '#6B7280',
    })
    session.flash('success', 'Tag created.')
    return response.redirect().back()
  }

  async update({ params, request, response, session }: HttpContext) {
    const tag = await Tag.findOrFail(params.tag || params.id)
    const data = request.only(['name', 'slug', 'color'])
    tag.merge({
      name: data.name,
      ...(data.slug && { slug: data.slug }),
      ...(data.color && { color: data.color }),
    })
    await tag.save()
    session.flash('success', 'Tag updated.')
    return response.redirect().back()
  }

  async destroy({ params, response, session }: HttpContext) {
    const tag = await Tag.findOrFail(params.tag || params.id)
    await tag.delete()
    session.flash('success', 'Tag deleted.')
    return response.redirect().back()
  }
}
