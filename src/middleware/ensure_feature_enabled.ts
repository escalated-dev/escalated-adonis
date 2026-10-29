import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { accessFeatureEnabled, type AccessFeature } from '../support/access_features.js'

export interface EnsureFeatureEnabledOptions {
  feature: AccessFeature
}

/**
 * Answers 404 while an install-level access feature (roles & permissions,
 * two-factor, SSO) is switched off, so its screens and routes look as if they
 * were never registered (ADR 2026-10-29-configurable-access-features).
 *
 * The routes stay registered and this decides per request, so the switch is
 * read when the request arrives rather than when routes were registered.
 *
 * Usage: `.use(middleware.ensureFeatureEnabled({ feature: 'roles_permissions' }))`
 */
export default class EnsureFeatureEnabled {
  async handle(ctx: HttpContext, next: NextFn, options: EnsureFeatureEnabledOptions) {
    if (!accessFeatureEnabled(options.feature)) {
      return ctx.response.notFound({ error: 'Not Found' })
    }
    return next()
  }
}
