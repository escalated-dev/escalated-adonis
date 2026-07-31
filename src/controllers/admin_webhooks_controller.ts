import type { HttpContext } from '@adonisjs/core/http'
import Webhook from '../models/webhook.js'
import WebhookDelivery from '../models/webhook_delivery.js'
import WebhookDispatcher from '../services/webhook_dispatcher.js'
import { WEBHOOK_EVENTS } from '../support/webhook_events.js'
import { getRenderer } from '../rendering/renderer.js'
import { t } from '../support/i18n.js'

/**
 * Admin CRUD + delivery-log surface for outbound webhooks. Mirrors the Laravel
 * `Admin\WebhookController`.
 */
export default class AdminWebhooksController {
  /**
   * GET /support/admin/webhooks — list webhooks with delivery count + latest.
   */
  async index(ctx: HttpContext) {
    const webhooks = await Webhook.query()
      .withCount('deliveries')
      .preload('deliveries', (q) => q.orderBy('created_at', 'desc').limit(1))
      .orderBy('created_at', 'desc')

    const rows = webhooks.map((webhook) => {
      const latest = webhook.deliveries[0]
      return {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
        has_secret: Boolean(webhook.secret),
        deliveries_count: Number(webhook.$extras.deliveries_count ?? 0),
        latest_delivery: latest
          ? {
              id: latest.id,
              event: latest.event,
              response_code: latest.responseCode,
              delivered_at: latest.deliveredAt?.toISO() ?? null,
              created_at: latest.createdAt?.toISO() ?? null,
            }
          : null,
        created_at: webhook.createdAt?.toISO() ?? null,
      }
    })

    return getRenderer().render(ctx, 'Escalated/Admin/Webhooks/Index', {
      webhooks: rows,
      availableEvents: WEBHOOK_EVENTS,
    })
  }

  /**
   * POST /support/admin/webhooks — create a webhook.
   */
  async store({ request, response, session }: HttpContext) {
    const data = request.only(['url', 'events', 'secret', 'active'])

    const error = this.validate(data)
    if (error) {
      session.flash('error', error)
      return response.redirect().back()
    }

    await Webhook.create({
      url: data.url,
      events: this.normalizeEvents(data.events),
      secret: data.secret || null,
      active: data.active !== false,
    })

    session.flash('success', t('admin.webhook_created'))
    return response.redirect().back()
  }

  /**
   * PUT /support/admin/webhooks/:webhook — update a webhook.
   */
  async update({ params, request, response, session }: HttpContext) {
    const webhook = await Webhook.findOrFail(params.webhook || params.id)
    const data = request.only(['url', 'events', 'secret', 'active'])

    const error = this.validate(data)
    if (error) {
      session.flash('error', error)
      return response.redirect().back()
    }

    webhook.merge({
      url: data.url,
      events: this.normalizeEvents(data.events),
      secret: data.secret || null,
      active: data.active !== false,
    })
    await webhook.save()

    session.flash('success', t('admin.webhook_updated'))
    return response.redirect().back()
  }

  /**
   * DELETE /support/admin/webhooks/:webhook — delete a webhook (cascades
   * delivery rows).
   */
  async destroy({ params, response, session }: HttpContext) {
    const webhook = await Webhook.findOrFail(params.webhook || params.id)
    await webhook.delete()
    session.flash('success', t('admin.webhook_deleted'))
    return response.redirect().back()
  }

  /**
   * GET /support/admin/webhooks/:webhook/deliveries — paginated delivery log.
   */
  async deliveries(ctx: HttpContext) {
    const { params, request } = ctx
    const webhook = await Webhook.findOrFail(params.webhook || params.id)

    const page = Number(request.input('page', 1)) || 1
    const deliveries = await webhook
      .related('deliveries')
      .query()
      .orderBy('created_at', 'desc')
      .paginate(page, 25)

    return getRenderer().render(ctx, 'Escalated/Admin/Webhooks/DeliveryLog', {
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
      },
      deliveries: deliveries.serialize(),
    })
  }

  /**
   * POST /support/admin/webhooks/deliveries/:delivery/retry — re-send a
   * recorded delivery.
   */
  async retry({ params, response, session }: HttpContext) {
    const delivery = await WebhookDelivery.findOrFail(params.delivery || params.id)
    await new WebhookDispatcher().retryDelivery(delivery)
    session.flash('success', t('admin.webhook_retried'))
    return response.redirect().back()
  }

  // ---- Private helpers ----

  /** Coerce the incoming events value into a clean array of known event names. */
  protected normalizeEvents(events: unknown): string[] {
    const list = Array.isArray(events) ? events : events ? [events] : []
    const allowed = new Set<string>(WEBHOOK_EVENTS)
    return [...new Set(list.map((e) => String(e)))].filter((e) => allowed.has(e))
  }

  /** Returns an error message string when the payload is invalid, else null. */
  protected validate(data: { url?: unknown; events?: unknown }): string | null {
    const url = typeof data.url === 'string' ? data.url.trim() : ''
    if (!url || !/^https?:\/\//i.test(url)) {
      return 'A valid http(s) URL is required.'
    }
    if (this.normalizeEvents(data.events).length === 0) {
      return 'At least one event must be selected.'
    }
    return null
  }
}
