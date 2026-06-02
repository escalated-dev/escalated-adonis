import { randomBytes } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Contact from '../models/contact.js'
import Newsletter from '../models/newsletter/newsletter.js'
import NewsletterDelivery from '../models/newsletter/newsletter_delivery.js'
import NewsletterList from '../models/newsletter/newsletter_list.js'
import NewsletterTemplate from '../models/newsletter/newsletter_template.js'
import { getConfig } from '../helpers/config.js'
import { getRenderer } from '../rendering/renderer.js'
import NewsletterPlanner from '../services/newsletter/newsletter_planner.js'
import NewsletterPermissionService from '../services/newsletter/newsletter_permission_service.js'
import NewsletterRenderer from '../services/newsletter/newsletter_renderer.js'
import { redirectToRoute } from '../support/routing.js'
import {
  assertEmail,
  assertOneOf,
  discoverNewsletterThemes,
  mailConfigured,
  NewsletterValidationError,
  optionalDateAfterNow,
  optionalInteger,
  optionalString,
  requiredInteger,
  requiredString,
  userIdFromAuth,
  abort422,
} from '../support/newsletter_http.js'

export default class AdminNewsletterController {
  private readonly permissions = new NewsletterPermissionService()
  private readonly planner = new NewsletterPlanner()
  private readonly renderer = new NewsletterRenderer(this.rendererOptions())

  async index(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    const tab = String(ctx.request.input('tab', 'drafts'))
    const statuses =
      tab === 'scheduled'
        ? ['scheduled', 'sending', 'paused']
        : tab === 'sent'
          ? ['sent', 'failed']
          : ['draft']

    const newsletters = await Newsletter.query()
      .whereIn('status', statuses)
      .preload('targetList')
      .orderBy('created_at', 'desc')
      .paginate(50, ctx.request.input('page', 1))

    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Index', { newsletters, tab })
  }

  async create(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return
    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Compose', await this.composeProps())
  }

  async store(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    try {
      const data = await this.validateForm(ctx.request.all())
      if (['scheduled', 'sending'].includes(data.status)) {
        if (!(await this.permissions.require(ctx, 'newsletters.send'))) return
        if (!(await mailConfigured())) {
          ctx.session.flash('errors', { from_email: 'Outbound mail is not configured.' })
          return ctx.response.redirect().back()
        }
      }

      const newsletter = await Newsletter.create({
        ...data,
        createdBy: userIdFromAuth(ctx.auth.user) as number | null,
      })

      if (data.status === 'sending') {
        await this.planner.plan(newsletter)
      }

      redirectToRoute(ctx.response, 'escalated.admin.newsletters.show', { newsletter: newsletter.id })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async preview(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    try {
      const body = ctx.request.all()
      const fromEmail =
        assertEmail(optionalString(body, 'from_email'), 'from_email') ?? 'preview@example.test'
      const newsletter = new Newsletter()
      newsletter.subject = optionalString(body, 'subject', 998) ?? ''
      newsletter.fromEmail = fromEmail
      newsletter.fromName = null
      newsletter.replyTo = null
      newsletter.targetListId = optionalInteger(body, 'target_list_id') ?? 0
      newsletter.templateId = null
      newsletter.theme = optionalString(body, 'theme', 64) ?? 'default'
      newsletter.bodyMarkdown = optionalString(body, 'body_markdown')

      const contact = new Contact()
      contact.id = 0
      contact.email = 'preview@example.test'
      contact.name = 'Preview User'

      const delivery = this.previewDelivery(newsletter, contact, 'preview')
      return ctx.response.json({ html: this.renderer.render(delivery) })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async testSend(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.send'))) return

    try {
      const data = await this.validateForm(ctx.request.all())
      if (!(await mailConfigured())) {
        return ctx.response.unprocessableEntity({
          from_email: 'Outbound mail is not configured.',
        })
      }

      const user = ctx.auth.user as { email?: string; name?: string }
      const contact = new Contact()
      contact.id = Number(userIdFromAuth(user) ?? 0)
      contact.email = user?.email ?? data.fromEmail
      contact.name = user?.name ?? 'Tester'

      const newsletter = new Newsletter()
      Object.assign(newsletter, {
        subject: data.subject,
        fromEmail: data.fromEmail,
        fromName: data.fromName,
        replyTo: data.replyTo,
        targetListId: data.targetListId,
        templateId: data.templateId,
        theme: data.theme,
        bodyMarkdown: data.bodyMarkdown,
        status: 'draft',
      })

      const delivery = this.previewDelivery(newsletter, contact, randomBytes(20).toString('hex'))
      delivery.isTest = true
      const html = this.renderer.render(delivery)

      const { default: mail } = await import('@adonisjs/mail/services/main')
      await mail.send((message) => {
        message
          .to(contact.email)
          .from(data.fromEmail, data.fromName ?? undefined)
          .subject(`[TEST] ${data.subject}`)
          .html(html)
        if (data.replyTo) message.replyTo(data.replyTo)
      })

      return ctx.response.json({ ok: true })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async show(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    const newsletter = await this.findNewsletter(Number(ctx.params.newsletter))
    const tab = String(ctx.request.input('tab', 'overview'))
    const statusFilter = ctx.request.input('status')

    const query = NewsletterDelivery.query()
      .where('newsletter_id', newsletter.id)
      .where('is_test', false)
      .preload('contact', (q) => q.select('id', 'name', 'email'))
      .orderBy('id', 'desc')

    if (statusFilter) {
      query.where('status', statusFilter)
    }

    const deliveries = await query.paginate(100, ctx.request.input('page', 1))

    return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Show', {
      newsletter,
      deliveries,
      topClicks: [],
      tab,
    })
  }

  async edit(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    try {
      const newsletter = await this.findNewsletter(Number(ctx.params.newsletter))
      if (!['draft', 'scheduled'].includes(newsletter.status)) {
        abort422('Only drafts and scheduled newsletters can be edited')
      }

      return getRenderer().render(ctx, 'Escalated/Admin/Newsletters/Edit', {
        ...(await this.composeProps()),
        newsletter,
      })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async update(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    try {
      const newsletter = await this.findNewsletter(Number(ctx.params.newsletter))
      const data = await this.validateForm(ctx.request.all())
      if (['scheduled', 'sending'].includes(data.status)) {
        if (!(await this.permissions.require(ctx, 'newsletters.send'))) return
      }

      newsletter.merge(data)
      await newsletter.save()

      if (data.status === 'sending') {
        await this.planner.plan(newsletter)
      }

      redirectToRoute(ctx.response, 'escalated.admin.newsletters.show', { newsletter: newsletter.id })
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  async destroy(ctx: HttpContext) {
    if (!(await this.permissions.require(ctx, 'newsletters.manage'))) return

    try {
      const newsletter = await this.findNewsletter(Number(ctx.params.newsletter))
      if (newsletter.status !== 'draft') {
        abort422('Only drafts can be deleted')
      }
      await newsletter.delete()
      redirectToRoute(ctx.response, 'escalated.admin.newsletters.index')
    } catch (error) {
      return this.handleValidation(ctx, error)
    }
  }

  private async composeProps() {
    const config = getConfig() as any
    const lists = await NewsletterList.query().select('id', 'name')
    const listProps = await Promise.all(
      lists.map(async (list) => {
        const count = await list.related('members').query().count('* as total')
        return {
          ...list.serialize(),
          member_count: Number((count[0] as any).$extras?.total ?? 0),
        }
      })
    )

    return {
      lists: listProps,
      templates: await NewsletterTemplate.query().select('id', 'name'),
      themes: discoverNewsletterThemes(config.newsletters?.themesDir),
      mailConfigured: await mailConfigured(),
      canSend: true,
      defaultFromEmail: config.newsletters?.defaultFrom ?? null,
      defaultReplyTo: config.newsletters?.defaultReplyTo ?? null,
      defaultTheme: config.newsletters?.defaultTheme ?? 'default',
    }
  }

  private async validateForm(body: Record<string, unknown>) {
    const targetListId = requiredInteger(body, 'target_list_id')
    const list = await NewsletterList.find(targetListId)
    if (!list) {
      throw new NewsletterValidationError('target_list_id does not exist', {
        target_list_id: 'target_list_id does not exist',
      })
    }

    const templateId = optionalInteger(body, 'template_id')
    if (templateId) {
      const template = await NewsletterTemplate.find(templateId)
      if (!template) {
        throw new NewsletterValidationError('template_id does not exist', {
          template_id: 'template_id does not exist',
        })
      }
    }

    const scheduledAt = optionalDateAfterNow(body, 'scheduled_at')

    return {
      subject: requiredString(body, 'subject', 998),
      fromEmail: assertEmail(requiredString(body, 'from_email', 320), 'from_email', true)!,
      fromName: optionalString(body, 'from_name', 255),
      replyTo: assertEmail(optionalString(body, 'reply_to', 320), 'reply_to'),
      targetListId,
      templateId,
      theme: optionalString(body, 'theme', 64),
      bodyMarkdown: optionalString(body, 'body_markdown'),
      status: assertOneOf(body.status ?? 'draft', 'status', ['draft', 'scheduled', 'sending']),
      scheduledAt: scheduledAt ? DateTime.fromJSDate(scheduledAt) : null,
    }
  }

  private async findNewsletter(id: number): Promise<Newsletter> {
    const newsletter = await Newsletter.query()
      .where('id', id)
      .preload('targetList')
      .preload('template')
      .first()
    if (!newsletter) {
      throw new NewsletterValidationError(`Newsletter #${id} not found`)
    }
    return newsletter
  }

  private previewDelivery(
    newsletter: Newsletter,
    contact: Contact,
    token: string
  ): NewsletterDelivery {
    const delivery = new NewsletterDelivery()
    ;(delivery as any).newsletter = newsletter
    ;(delivery as any).contact = contact
    delivery.emailAtSend = contact.email
    delivery.trackingToken = token
    delivery.status = 'pending'
    delivery.isTest = false
    return delivery
  }

  private rendererOptions() {
    const config = getConfig() as any
    return {
      baseUrl: config.appUrl ?? process.env.APP_URL ?? 'http://localhost',
      appName: config.appName,
      defaultTheme: config.newsletters?.defaultTheme ?? 'default',
      trackingEnabled: config.newsletters?.trackingEnabled !== false,
      themesDir: config.newsletters?.themesDir,
      brand: {
        accent: config.newsletters?.brandAccent,
        logoUrl: config.newsletters?.brandLogoUrl,
        physicalAddress: config.newsletters?.brandPhysicalAddress,
      },
    }
  }

  private handleValidation(ctx: HttpContext, error: unknown) {
    if (error instanceof NewsletterValidationError) {
      if (ctx.request.accepts(['html', 'json']) === 'json') {
        return ctx.response.unprocessableEntity(error.errors)
      }
      ctx.session.flash('errors', error.errors)
      return ctx.response.redirect().back()
    }
    throw error
  }
}
