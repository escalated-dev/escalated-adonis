import type { HttpContext } from '@adonisjs/core/http'
import Department from '../models/department.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'
import { t } from '../support/i18n.js'
import { formRecord } from '../support/form_record.js'
import { scheduleOptions, scheduleReference } from '../support/business_schedule_reference.js'

export default class AdminDepartmentsController {
  async index(ctx: HttpContext) {
    const departments = await Department.query().withCount('tickets')

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

    return getRenderer().render(ctx, 'Escalated/Admin/Departments/Index', { departments })
  }

  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Departments/Form', {
      schedules: await scheduleOptions(),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = request.only(['name', 'slug', 'description', 'is_active'])
    const schedule = await scheduleReference(request.all())
    if ('errors' in schedule) {
      session.flash('errors', schedule.errors)
      return response.redirect().back()
    }
    await Department.create({
      name: data.name,
      slug: data.slug || undefined,
      description: data.description || null,
      isActive: data.is_active !== false,
      ...schedule,
    })
    session.flash('success', t('admin.department_created'))
    return redirectToRoute(response, 'escalated.admin.departments.index')
  }

  async edit(ctx: HttpContext) {
    const department = await Department.findOrFail(ctx.params.id)
    return getRenderer().render(ctx, 'Escalated/Admin/Departments/Form', {
      department: formRecord(department),
      schedules: await scheduleOptions(),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    const department = await Department.findOrFail(params.id)
    const data = request.only(['name', 'slug', 'description', 'is_active'])
    const schedule = await scheduleReference(request.all())
    if ('errors' in schedule) {
      session.flash('errors', schedule.errors)
      return response.redirect().back()
    }
    department.merge({
      name: data.name,
      ...(data.slug && { slug: data.slug }),
      description: data.description || null,
      isActive: data.is_active !== false,
      ...schedule,
    })
    await department.save()
    session.flash('success', t('admin.department_updated'))
    return redirectToRoute(response, 'escalated.admin.departments.index')
  }

  async destroy({ params, response, session }: HttpContext) {
    const department = await Department.findOrFail(params.id)
    await department.delete()
    session.flash('success', t('admin.department_deleted'))
    return redirectToRoute(response, 'escalated.admin.departments.index')
  }
}
