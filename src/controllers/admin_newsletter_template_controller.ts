import type { HttpContext } from '@adonisjs/core/http'
import NewsletterTemplate from '../models/newsletter/newsletter_template.js'
import { getConfig } from '../helpers/config.js'
import { getRenderer } from '../rendering/renderer.js'
import NewsletterPermissionService from '../services/newsletter/newsletter_permission_service.js'
import { redirectToRoute } from '../support/routing.js'
import {
  assertArrayOrNull,
  discoverNewsletterThemes,
  NewsletterValidationError,
  optionalString,
  requiredString,
  userIdFromAuth,
} from '../support/newsletter_http.js'

export default class AdminNewsletterTemplateController {
  private readonly permissions = new NewsletterPermissionService()

  async index(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    const templates = await NewsletterTemplate.query().orderBy('created_at', 'desc')
    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Templates/Index', { templates })
  }

  async create(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Templates/Create', {
      themes: this.themes(),
    })
  }

  async store(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    try {
      const body = ctx.request.all()
      await NewsletterTemplate.create({
        name: requiredString(body, 'name', 255),
        theme: requiredString(body, 'theme', 64),
        subjectTemplate: optionalString(body, 'subject_template', 998),
        bodyMarkdown: requiredString(body, 'body_markdown'),
        mergeFieldsSchema: assertArrayOrNull(body.merge_fields_schema, 'merge_fields_schema'),
        createdBy: userIdFromAuth(ctx.auth.user) as number | null,
      })
      redirectToRoute(ctx.response, 'escalated.admin.newsletters.templates.index')
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async show(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    const template = await NewsletterTemplate.findOrFail(ctx.params.template)
    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Templates/Show', {
      template,
      themes: this.themes(),
      isNew: false,
    })
  }

  async update(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    try {
      const template = await NewsletterTemplate.findOrFail(ctx.params.template)
      const body = ctx.request.all()
      template.merge({
        name: requiredString(body, 'name', 255),
        theme: requiredString(body, 'theme', 64),
        subjectTemplate: optionalString(body, 'subject_template', 998),
        bodyMarkdown: requiredString(body, 'body_markdown'),
        mergeFieldsSchema: assertArrayOrNull(body.merge_fields_schema, 'merge_fields_schema'),
      })
      await template.save()
      redirectToRoute(ctx.response, 'escalated.admin.newsletters.templates.show', {
        template: template.id,
      })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async destroy(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    const template = await NewsletterTemplate.findOrFail(ctx.params.template)
    await template.delete()
    redirectToRoute(ctx.response, 'escalated.admin.newsletters.templates.index')
  }

  private themes(): string[] {
    const config = getConfig() as any
    return discoverNewsletterThemes(config.newsletters?.themesDir)
  }

  private handleValidation(ctx: HttpContext, error: unknown) {
    if (error instanceof NewsletterValidationError) {
      ctx.session.flash('errors', error.errors)
      return ctx.response.redirect().back()
    }
    throw error
  }
}
