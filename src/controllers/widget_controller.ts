import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../models/ticket.js'
import EscalatedSetting from '../models/escalated_setting.js'
import Article from '../models/article.js'
import TicketService from '../services/ticket_service.js'
import { sanitizeWidgetMetadata } from '../support/widget_metadata.js'
import { WIDGET_ORIGIN } from '../support/widget_origins.js'
import { activeDepartmentId, articleExcerpt } from '../support/widget_contract.js'
import Department from '../models/department.js'

/**
 * Public widget API controller.
 *
 * All endpoints are unauthenticated and rate-limited. They power an
 * embeddable support widget that can be dropped into any website.
 */
export default class WidgetController {
  protected ticketService = new TicketService()

  /**
   * GET /widget/config — Return widget configuration / branding
   */
  async config(ctx: HttpContext) {
    const [
      widgetEnabled,
      brandName,
      accentColor,
      logoUrl,
      kbEnabled,
      position,
      greeting,
      guestTicketsEnabled,
    ] = await Promise.all([
      EscalatedSetting.getBool('widget_enabled', true),
      EscalatedSetting.get('brand_name', 'Support'),
      EscalatedSetting.get('widget_accent_color', '#3B82F6'),
      EscalatedSetting.get('widget_logo_url', null),
      EscalatedSetting.getBool('knowledge_base_enabled', false),
      EscalatedSetting.get('widget_position', 'bottom-right'),
      EscalatedSetting.get('widget_greeting', 'Hi there! How can we help?'),
      EscalatedSetting.guestTicketsEnabled(),
    ])

    if (!widgetEnabled) {
      return ctx.response.forbidden({ enabled: false, error: 'Widget is disabled' })
    }

    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())
      .orderBy('name', 'asc')
      .select('id', 'name')

    return ctx.response.json({
      enabled: true,
      // Keys read by the shared widget (`@escalated-dev/escalated`).
      color: accentColor,
      position,
      greeting,
      departments: departments.map((d) => ({ id: d.id, name: d.name })),
      kb_enabled: kbEnabled,
      guest_tickets_enabled: guestTicketsEnabled,
      // Ticket status needs mailbox verification, which this package does not
      // offer, so the widget hides its status tab.
      status_lookup_enabled: false,
      // Keys earlier clients read.
      brand_name: brandName,
      accent_color: accentColor,
      logo_url: logoUrl,
      knowledge_base_enabled: kbEnabled,
      // Widget tickets and chats store the host parameters a page sends.
      accepts_metadata: true,
    })
  }

  /**
   * GET /widget/articles — List / search published knowledge base articles
   */
  async articles(ctx: HttpContext) {
    const kbEnabled = await EscalatedSetting.getBool('knowledge_base_enabled', false)
    if (!kbEnabled) {
      return ctx.response.notFound({ error: 'Knowledge base is disabled' })
    }

    const { q, limit } = ctx.request.only(['q', 'limit'])
    const maxResults = Math.min(Number(limit) || 10, 25)
    const term = typeof q === 'string' ? q.trim() : ''

    const query = Article.query()
      .withScopes((scopes) => scopes.published())
      .preload('category')

    if (term !== '') {
      query.withScopes((scopes) => scopes.search(term))
    }

    const articles = await query.orderBy('published_at', 'desc').limit(maxResults)

    return ctx.response.json({
      articles: articles.map((article) => serializeSummary(article)),
      query: term,
      limit: maxResults,
    })
  }

  /**
   * GET /widget/articles/:slug — Get a single published article by slug
   */
  async articleDetail(ctx: HttpContext) {
    const kbEnabled = await EscalatedSetting.getBool('knowledge_base_enabled', false)
    if (!kbEnabled) {
      return ctx.response.notFound({ error: 'Knowledge base is disabled' })
    }

    const slug = String(ctx.params.slug ?? '')

    const article = await Article.query()
      .withScopes((scopes) => scopes.published())
      .where('slug', slug)
      .preload('category')
      .first()

    if (!article) {
      return ctx.response.notFound({ error: `Article "${slug}" not found` })
    }

    await article.incrementViews()

    const related = await Article.query()
      .withScopes((scopes) => scopes.published())
      .where('category_id', article.categoryId ?? 0)
      .whereNot('id', article.id)
      .orderBy('published_at', 'desc')
      .limit(5)
      .select('id', 'title', 'slug')

    const detail = {
      ...serializeSummary(article),
      body: article.body,
      view_count: article.viewCount,
      published_at: article.publishedAt?.toISO() ?? null,
    }

    // The shared widget reads the article's fields at the top level; earlier
    // clients read them under `article`.
    return ctx.response.json({
      ...detail,
      article: detail,
      related: related.map((r) => ({ id: r.id, title: r.title, slug: r.slug })),
    })
  }

  /**
   * POST /widget/tickets — Create a ticket from the widget (guest)
   *
   * As Laravel's WidgetController::createTicket: refused with 403 while the
   * widget or guest tickets are switched off, validated, then created through
   * the guest ticket path (guest policy, contact, SLA, TICKET_CREATED).
   * Laravel also requires mailbox verification here; this package has no
   * guest verification yet, so that step is not enforced.
   */
  async createTicket(ctx: HttpContext) {
    const widgetEnabled = await EscalatedSetting.getBool('widget_enabled', true)
    if (!widgetEnabled) {
      return ctx.response.forbidden({ message: 'Widget is disabled.', error: 'Widget is disabled' })
    }

    if (!(await EscalatedSetting.guestTicketsEnabled())) {
      const error = 'Guest tickets are disabled.'
      return ctx.response.forbidden({ message: error, error })
    }

    const data = ctx.request.only(['name', 'email', 'subject', 'description', 'department_id'])

    const invalid = validateWidgetTicket(data)
    if (invalid) {
      return ctx.response.badRequest({ message: invalid, error: invalid })
    }

    const hostMetadata = sanitizeWidgetMetadata(
      ctx.request.input('metadata'),
      (ctx as any)[WIDGET_ORIGIN] ?? null
    )
    if (!hostMetadata.valid) {
      return ctx.response.badRequest({ message: hostMetadata.error, error: hostMetadata.error })
    }

    const ticket = await this.ticketService.createGuest({
      name: typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : null,
      email: data.email.trim(),
      subject: data.subject.trim(),
      description: data.description,
      channel: 'widget',
      departmentId: await activeDepartmentId(data.department_id),
      metadata: { ...hostMetadata.metadata, source: 'widget' },
    })

    return ctx.response.created({
      message: 'Ticket created successfully.',
      reference: ticket.reference,
      ticket_reference: ticket.reference,
      guest_token: ticket.guestToken,
    })
  }

  /**
   * GET /widget/tickets/:token — Lookup a ticket by guest token
   */
  async lookupTicket(ctx: HttpContext) {
    const { token } = ctx.params

    const ticket = await Ticket.query()
      .where('guest_token', token)
      .preload('replies', (query) => {
        query.where('is_internal_note', false).orderBy('created_at', 'asc')
      })
      .firstOrFail()

    return ctx.response.json({
      reference: ticket.reference,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.createdAt.toISO(),
      replies: ticket.replies.map((r) => ({
        body: r.body,
        author_type: r.authorType,
        created_at: r.createdAt.toISO(),
      })),
    })
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The widget ticket's field rules, as Laravel validates them: email, subject
 * and description are required; name, email and subject at most 255
 * characters; description at most 5000. Returns the first problem, or null.
 */
function validateWidgetTicket(data: Record<string, any>): string | null {
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  if (!text(data.email) || !text(data.subject) || !text(data.description)) {
    return 'Missing required fields: email, subject, description'
  }
  if (data.name !== undefined && data.name !== null && typeof data.name !== 'string') {
    return 'The name must be text.'
  }
  if (text(data.name).length > 255) return 'The name may not be longer than 255 characters.'
  if (text(data.email).length > 255 || !EMAIL_PATTERN.test(text(data.email))) {
    return 'The email must be a valid email address.'
  }
  if (text(data.subject).length > 255) return 'The subject may not be longer than 255 characters.'
  if (String(data.description).length > 5000) {
    return 'The description may not be longer than 5000 characters.'
  }
  return null
}

/**
 * Serialize an article to the compact summary shape returned by the widget
 * list endpoint (and reused as the base of the detail payload).
 */
function serializeSummary(article: Article) {
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: articleExcerpt(article.body),
    category: article.category ? { id: article.category.id, name: article.category.name } : null,
  }
}
