import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import EscalatedSetting from '../models/escalated_setting.js'

/**
 * Middleware that guards knowledge base routes.
 *
 * Checks `knowledge_base_enabled` and optionally `knowledge_base_public`.
 * When the KB is disabled, all KB routes return 404. When the KB is not
 * public, unauthenticated users are rejected with 403.
 */
export default class KnowledgeBaseGuard {
  async handle(ctx: HttpContext, next: NextFn) {
    const kbEnabled = await EscalatedSetting.getBool('knowledge_base_enabled', false)

    if (!kbEnabled) {
      return ctx.response.notFound({ error: 'Knowledge base is disabled' })
    }

    const kbPublic = await EscalatedSetting.getBool('knowledge_base_public', true)

    if (!kbPublic) {
      // If the KB is not public, require authentication
      const user = ctx.auth?.user
      if (!user) {
        return ctx.response.forbidden({ error: 'Knowledge base access requires authentication' })
      }
    }

    return next()
  }
}
