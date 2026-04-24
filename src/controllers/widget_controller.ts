import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../models/ticket.js'
import EscalatedSetting from '../models/escalated_setting.js'
import TicketService from '../services/ticket_service.js'

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
    const [widgetEnabled, brandName, accentColor, logoUrl, kbEnabled] = await Promise.all([
      EscalatedSetting.getBool('widget_enabled', true),
      EscalatedSetting.get('brand_name', 'Support'),
      EscalatedSetting.get('widget_accent_color', '#3B82F6'),
      EscalatedSetting.get('widget_logo_url', null),
      EscalatedSetting.getBool('knowledge_base_enabled', false),
    ])

    if (!widgetEnabled) {
      return ctx.response.notFound({ error: 'Widget is disabled' })
    }

    return ctx.response.json({
      brand_name: brandName,
      accent_color: accentColor,
      logo_url: logoUrl,
      knowledge_base_enabled: kbEnabled,
    })
  }

  /**
   * GET /widget/articles — Search knowledge base articles
   */
  async articles(ctx: HttpContext) {
    const kbEnabled = await EscalatedSetting.getBool('knowledge_base_enabled', false)
    if (!kbEnabled) {
      return ctx.response.notFound({ error: 'Knowledge base is disabled' })
    }

    const { q, limit } = ctx.request.only(['q', 'limit'])
    const maxResults = Math.min(Number(limit) || 10, 25)

    // Placeholder: in a full implementation this would query an articles table.
    // For now we return an empty result set to establish the API contract.
    return ctx.response.json({
      articles: [],
      query: q ?? '',
      limit: maxResults,
    })
  }

  /**
   * GET /widget/articles/:id — Get a single article
   */
  async articleDetail(ctx: HttpContext) {
    const kbEnabled = await EscalatedSetting.getBool('knowledge_base_enabled', false)
    if (!kbEnabled) {
      return ctx.response.notFound({ error: 'Knowledge base is disabled' })
    }

    const articleId = ctx.params.id

    // Placeholder: return 404 until articles table exists
    return ctx.response.notFound({ error: `Article ${articleId} not found` })
  }

  /**
   * POST /widget/tickets — Create a ticket from the widget (guest)
   */
  async createTicket(ctx: HttpContext) {
    const widgetEnabled = await EscalatedSetting.getBool('widget_enabled', true)
    if (!widgetEnabled) {
      return ctx.response.notFound({ error: 'Widget is disabled' })
    }

    const data = ctx.request.only(['name', 'email', 'subject', 'description'])

    if (!data.email || !data.subject || !data.description) {
      return ctx.response.badRequest({
        error: 'Missing required fields: email, subject, description',
      })
    }

    const { randomBytes } = await import('node:crypto')
    const { resolveGuestPolicy } = await import('../helpers/guest_policy.js')
    const guestToken = randomBytes(32).toString('hex')
    const reference = await Ticket.generateReference()
    const policy = await resolveGuestPolicy()

    const ticket = await Ticket.create({
      reference,
      requesterType: policy.requesterType,
      requesterId: policy.requesterId,
      guestName: data.name || null,
      guestEmail: data.email,
      guestToken,
      subject: data.subject,
      description: data.description,
      status: 'open',
      priority: 'medium',
      ticketType: 'question',
      channel: 'widget',
      metadata: { source: 'widget' },
      slaFirstResponseBreached: false,
      slaResolutionBreached: false,
    })

    return ctx.response.created({
      ticket_reference: ticket.reference,
      guest_token: guestToken,
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
