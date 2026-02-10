import type { HttpContext } from '@adonisjs/core/http'
import Department from '../models/department.js'

export default class AdminDepartmentsController {
  async index({ inertia }: HttpContext) {
    const departments = await Department.query()
      .withCount('tickets')

    // Also get agent counts via raw query
    const { default: db } = await import('@adonisjs/lucid/services/db')
    for (const dept of departments) {
      const agentCount = await db
        .from('escalated_department_agent')
        .where('department_id', dept.id)
        .count('* as total')
        .first()
      ;(dept as any).$extras.agents_count = Number(agentCount?.total ?? 0)
    }

    return inertia.render('Escalated/Admin/Departments/Index', { departments })
  }

  async create({ inertia }: HttpContext) {
    return inertia.render('Escalated/Admin/Departments/Form')
  }

  async store({ request, response, session }: HttpContext) {
    const data = request.only(['name', 'slug', 'description', 'is_active'])
    await Department.create({
      name: data.name,
      slug: data.slug || undefined,
      description: data.description || null,
      isActive: data.is_active !== false,
    })
    session.flash('success', 'Department created.')
    return response.redirect().toRoute('escalated.admin.departments.index')
  }

  async edit({ params, inertia }: HttpContext) {
    const department = await Department.findOrFail(params.id)
    return inertia.render('Escalated/Admin/Departments/Form', { department })
  }

  async update({ params, request, response, session }: HttpContext) {
    const department = await Department.findOrFail(params.id)
    const data = request.only(['name', 'slug', 'description', 'is_active'])
    department.merge({
      name: data.name,
      ...(data.slug && { slug: data.slug }),
      description: data.description || null,
      isActive: data.is_active !== false,
    })
    await department.save()
    session.flash('success', 'Department updated.')
    return response.redirect().toRoute('escalated.admin.departments.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const department = await Department.findOrFail(params.id)
    await department.delete()
    session.flash('success', 'Department deleted.')
    return response.redirect().toRoute('escalated.admin.departments.index')
  }
}
