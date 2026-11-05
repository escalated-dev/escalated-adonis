import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { escalatedSharedData } from '../support/shared_data.js'

/**
 * Router middleware registered only while the admin is embedded in the host's
 * admin panel (ADR 2026-11-05-embeddable-admin): shares the `escalated` prop,
 * with `embed` and `navigation`, on every Inertia response, the host's own
 * pages included, so the host's sidebar can list Escalated's admin menu.
 *
 * Shares through the request's Inertia instance (`ctx.inertia`, made by the
 * host's Inertia middleware). If that middleware has not run yet, the prop is
 * shared as soon as it does.
 */
export default class ShareEscalatedProps {
  async handle(ctx: HttpContext, next: NextFn) {
    const share = (inertia: any) => {
      if (inertia && typeof inertia.share === 'function') {
        inertia.share(async () => ({ escalated: await escalatedSharedData(ctx) }))
      }
    }

    const current = (ctx as any).inertia
    if (current) {
      share(current)
    } else {
      let value: unknown
      Object.defineProperty(ctx, 'inertia', {
        configurable: true,
        enumerable: true,
        get: () => value,
        set: (inertia: unknown) => {
          value = inertia
          share(inertia)
        },
      })
    }

    return next()
  }
}
