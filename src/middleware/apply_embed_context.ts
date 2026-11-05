import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { applyFrameHeaders, markEmbedded, resolveEmbed } from '../support/embed.js'
import { adminNavigation } from '../support/admin_navigation.js'

/**
 * Runs last on the admin routes while they are embedded in the host's admin
 * panel (ADR 2026-11-05-embeddable-admin), and on no other route.
 *
 * - Marks the request as embedded (`escalated.embed.enabled`).
 * - `ui.embed.rootView`: renders a full page load in that root view instead of
 *   the host's, and gives the template the admin menu as
 *   `escalatedNavigation` (adminNavigation()).
 * - iframe mode: `frame-ancestors` and no `X-Frame-Options` on this response,
 *   applied when its headers are written, after any host middleware.
 */
export default class ApplyEmbedContext {
  async handle(ctx: HttpContext, next: NextFn) {
    const embed = resolveEmbed()
    if (!embed) return next()

    markEmbedded(ctx)

    const inertia = (ctx as any).inertia
    if (embed.rootView && inertia && typeof inertia === 'object' && 'config' in inertia) {
      inertia.config = { ...inertia.config, rootView: embed.rootView }

      const view = (ctx as any).view
      if (view && typeof view.share === 'function' && !ctx.request.header('x-inertia')) {
        view.share({ escalatedNavigation: await adminNavigation((ctx as any).auth?.user, ctx) })
      }
    }

    if (embed.mode === 'iframe') {
      applyFrameHeaders(ctx, embed)
    }

    return next()
  }
}
