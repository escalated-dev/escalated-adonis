import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Article from '../models/article.js'
import AgentNotification from '../models/agent_notification.js'
import EscalatedSetting from '../models/escalated_setting.js'
import { requireAuthUser } from '../support/auth_user.js'
import { getConfig } from '../helpers/config.js'
import { authorizeAgentChannel, pusherConfigured } from '../support/realtime.js'
import {
  AGENT_STATUSES,
  NOTIFICATIONS_MAX_PER_PAGE,
  NOTIFICATIONS_PER_PAGE,
  markRead,
  markUnread,
  notificationsAvailable,
  presentNotifications,
  setAgentStatus,
  unreadCount,
  type AgentStatusValue,
} from '../services/agent_panel.js'

const KB_DEFAULT_LIMIT = 10
const KB_MAX_LIMIT = 20

function whole(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  return /^\d+$/.test(String(value)) ? Number(value) : -1
}

function inertia(ctx: HttpContext): boolean {
  return Boolean(ctx.request.header('x-inertia'))
}

function invalid(ctx: HttpContext, field: string, message: string) {
  if (inertia(ctx)) {
    ctx.session.flash('errors', { [field]: message })
    return ctx.response.redirect().back()
  }
  return ctx.response.status(422).json({ message, errors: { [field]: [message] } })
}

function answer(ctx: HttpContext, json: Record<string, unknown>) {
  return inertia(ctx) ? ctx.response.redirect().back() : ctx.response.json(json)
}

function excerpt(html: string | null | undefined): string {
  const text = String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 160 ? `${text.slice(0, 160).trimEnd()}...` : text
}

/**
 * The agent panel's own data routes (ADR 2026-11-05-agent-panel-data): the
 * agent's status, knowledge-base search, the notifications feed and per-agent
 * read markers. Each acts for the signed-in agent only. JSON clients get
 * JSON; an Inertia visit to a mutating route goes back.
 */
export default class AgentPanelController {
  /** PUT/POST /agent/status: any agent, light agents included, sets their own. */
  async status(ctx: HttpContext) {
    const value = ctx.request.input('status')
    if (!(AGENT_STATUSES as readonly string[]).includes(value)) {
      return invalid(
        ctx,
        'status',
        `The selected status is invalid (${AGENT_STATUSES.join(', ')}).`
      )
    }
    await setAgentStatus(requireAuthUser(ctx.auth).id, value as AgentStatusValue)
    return answer(ctx, { agent_status: value })
  }

  /** GET /agent/kb/search?q=: published articles, title matches first, then the newest. */
  async kbSearch(ctx: HttpContext) {
    if (!(await EscalatedSetting.getBool('knowledge_base_enabled', false))) {
      return ctx.response.notFound({ message: 'Not found' })
    }
    const q = String(ctx.request.input('q') ?? '').trim()
    if (q.length < 2 || q.length > 200) {
      return invalid(ctx, 'q', 'The q field must be between 2 and 200 characters.')
    }
    const limit = whole(ctx.request.input('limit'))
    if (limit !== null && (limit < 1 || limit > KB_MAX_LIMIT)) {
      return invalid(ctx, 'limit', `The limit field must be between 1 and ${KB_MAX_LIMIT}.`)
    }

    const articles = await Article.query()
      .withScopes((scopes) => {
        scopes.published()
        scopes.search(q)
        scopes.titleMatchFirst(q)
      })
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .preload('category')
      .limit(limit ?? KB_DEFAULT_LIMIT)

    const prefix = getConfig().routes?.prefix ?? 'support'
    const origin = `${ctx.request.protocol()}://${ctx.request.host()}`
    return ctx.response.json({
      data: articles.map((article) => ({
        id: article.id,
        title: article.title,
        excerpt: excerpt(article.body),
        url: `${origin}/${prefix}/kb/${encodeURIComponent(article.slug)}`,
        category: article.category
          ? { id: article.category.id, name: article.category.name }
          : null,
        updated_at: article.updatedAt ? article.updatedAt.toUTC().toISO() : null,
      })),
    })
  }

  /** POST /agent/tickets/:ticket/read */
  async markRead(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket
    await markRead(requireAuthUser(ctx.auth).id, ticket.id)
    return answer(ctx, { is_unread: false })
  }

  /** POST /agent/tickets/:ticket/unread */
  async markUnread(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket
    await markUnread(requireAuthUser(ctx.auth).id, ticket.id)
    return answer(ctx, { is_unread: true })
  }

  /** GET /agent/notifications */
  async notifications(ctx: HttpContext) {
    if (!notificationsAvailable()) return ctx.response.notFound({ message: 'Not found' })
    const user = requireAuthUser(ctx.auth)
    const page = whole(ctx.request.input('page'))
    const perPage = whole(ctx.request.input('per_page'))
    if (page !== null && page < 1) return invalid(ctx, 'page', 'The page field must be at least 1.')
    if (perPage !== null && (perPage < 1 || perPage > NOTIFICATIONS_MAX_PER_PAGE)) {
      return invalid(
        ctx,
        'per_page',
        `The per page field must be between 1 and ${NOTIFICATIONS_MAX_PER_PAGE}.`
      )
    }
    const current = page ?? 1
    const size = perPage ?? NOTIFICATIONS_PER_PAGE
    const unread = ['1', 'true'].includes(String(ctx.request.input('unread') ?? '').toLowerCase())

    const base = () => {
      const query = AgentNotification.query().where('user_id', user.id)
      if (unread) query.whereNull('read_at')
      return query
    }
    const totalRow = await base().count('* as total').first()
    const total = Number((totalRow as any)?.$extras?.total ?? 0)
    const rows = await base()
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .offset((current - 1) * size)
      .limit(size)

    return ctx.response.json({
      data: await presentNotifications(rows, ctx.auth.user),
      meta: {
        current_page: current,
        last_page: Math.max(1, Math.ceil(total / size)),
        per_page: size,
        total,
      },
      unread_count: await unreadCount(user.id),
    })
  }

  /** POST /agent/notifications/:id/read */
  async readNotification(ctx: HttpContext) {
    if (!notificationsAvailable()) return ctx.response.notFound({ message: 'Not found' })
    const user = requireAuthUser(ctx.auth)
    const row = await AgentNotification.query()
      .where('id', String(ctx.params.id))
      .where('user_id', user.id)
      .first()
    if (!row) return ctx.response.notFound({ message: 'Not found' })
    if (!row.readAt) {
      row.readAt = DateTime.now()
      await row.save()
    }
    return ctx.response.json({ unread_count: await unreadCount(user.id) })
  }

  /** POST /agent/notifications/read-all */
  async readAllNotifications(ctx: HttpContext) {
    if (!notificationsAvailable()) return ctx.response.notFound({ message: 'Not found' })
    const user = requireAuthUser(ctx.auth)
    const unread = await AgentNotification.query().where('user_id', user.id).whereNull('read_at')
    const now = DateTime.now()
    for (const row of unread) {
      row.readAt = now
      await row.save()
    }
    return ctx.response.json({ unread_count: 0 })
  }

  /**
   * Laravel Echo's private-channel authorization (Pusher protocol): signs
   * `socket_id:channel_name` for the signed-in agent's own channel
   * (`private-escalated.agents.{id}`); any other channel is refused.
   */
  async broadcastingAuth(ctx: HttpContext) {
    if (!pusherConfigured()) return ctx.response.notFound({ message: 'Not found' })
    const user = requireAuthUser(ctx.auth)
    const auth = authorizeAgentChannel(
      user.id,
      String(ctx.request.input('socket_id', '')),
      String(ctx.request.input('channel_name', ''))
    )
    if (!auth) return ctx.response.forbidden({ message: 'Forbidden' })
    return ctx.response.json(auth)
  }
}
