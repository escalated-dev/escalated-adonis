import type { HttpContext } from '@adonisjs/core/http'
import MentionService from '../services/mention_service.js'
import { getAuthUser } from '../support/auth_user.js'

export default class AgentMentionsController {
  async index(ctx: HttpContext) {
    const userId = getAuthUser(ctx.auth)?.id
    if (!userId) return ctx.response.unauthorized({ error: 'Unauthorized' })
    const service = new MentionService()
    const mentions = await service.unreadMentions(userId)
    return ctx.response.ok(mentions)
  }

  async markRead(ctx: HttpContext) {
    const userId = getAuthUser(ctx.auth)?.id
    if (!userId) return ctx.response.unauthorized({ error: 'Unauthorized' })
    const mentionIds = ctx.request.input('mention_ids', [])
    const service = new MentionService()
    await service.markAsRead(mentionIds, userId)
    return ctx.response.ok({ marked_read: mentionIds.length })
  }

  async searchAgents(ctx: HttpContext) {
    const query = ctx.request.input('q', '')
    const limit = Number(ctx.request.input('limit', 10))
    const service = new MentionService()
    const results = await service.searchAgents(query, limit)
    return ctx.response.ok(results)
  }
}
