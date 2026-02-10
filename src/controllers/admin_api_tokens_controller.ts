import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import ApiToken from '../models/api_token.js'
import { getConfig } from '../helpers/config.js'

export default class AdminApiTokensController {
  /**
   * GET /support/admin/api-tokens — List all API tokens (Inertia page)
   */
  async index({ inertia }: HttpContext) {
    const tokens = await ApiToken.query().orderBy('created_at', 'desc')

    const tokenData = await Promise.all(
      tokens.map(async (token) => {
        const owner = await token.loadTokenable()
        return {
          id: token.id,
          name: token.name,
          user_name: owner?.name ?? owner?.fullName ?? null,
          user_email: owner?.email ?? null,
          abilities: token.abilities,
          last_used_at: token.lastUsedAt?.toISO() ?? null,
          last_used_ip: token.lastUsedIp,
          expires_at: token.expiresAt?.toISO() ?? null,
          is_expired: token.isExpired(),
          created_at: token.createdAt.toISO(),
        }
      })
    )

    const users = await this.getAgentUsers()
    const config = getConfig() as any

    return inertia.render('Escalated/Admin/ApiTokens/Index', {
      tokens: tokenData,
      users,
      api_enabled: config.api?.enabled ?? false,
    })
  }

  /**
   * POST /support/admin/api-tokens — Create a new API token
   */
  async store(ctx: HttpContext) {
    const { name, user_id, abilities, expires_in_days } = ctx.request.only([
      'name', 'user_id', 'abilities', 'expires_in_days',
    ])

    if (!name || !user_id || !abilities || !Array.isArray(abilities)) {
      ctx.session.flash('error', 'Name, user, and abilities are required.')
      return ctx.response.redirect().back()
    }

    // Load the user model
    const config = (globalThis as any).__escalated_config
    const userModelPath = config?.userModel ?? '#models/user'
    const { default: UserModel } = await import(userModelPath)
    const user = await UserModel.findOrFail(user_id)

    const expiresAt = expires_in_days
      ? DateTime.now().plus({ days: Number(expires_in_days) })
      : null

    const result = await ApiToken.createToken(user, name, abilities, expiresAt)

    ctx.session.flash('success', 'API token created.')
    ctx.session.flash('plain_text_token', result.plainTextToken)
    return ctx.response.redirect().back()
  }

  /**
   * PUT /support/admin/api-tokens/:id — Update a token's name/abilities
   */
  async update(ctx: HttpContext) {
    const token = await ApiToken.findOrFail(ctx.params.id)
    const data = ctx.request.only(['name', 'abilities'])

    if (data.name !== undefined) {
      token.name = data.name
    }
    if (data.abilities !== undefined && Array.isArray(data.abilities)) {
      token.abilities = data.abilities
    }

    await token.save()

    ctx.session.flash('success', 'Token updated.')
    return ctx.response.redirect().back()
  }

  /**
   * DELETE /support/admin/api-tokens/:id — Revoke (delete) a token
   */
  async destroy(ctx: HttpContext) {
    const token = await ApiToken.findOrFail(ctx.params.id)
    await token.delete()

    ctx.session.flash('success', 'Token revoked.')
    return ctx.response.redirect().back()
  }

  // ---- Private Helpers ----

  /**
   * Get all users who pass the agent or admin gate.
   */
  protected async getAgentUsers(): Promise<{ id: number; name: string; email: string }[]> {
    const config = (globalThis as any).__escalated_config
    try {
      const userModelPath = config?.userModel ?? '#models/user'
      const { default: UserModel } = await import(userModelPath)
      const users = await UserModel.all()

      const agents: { id: number; name: string; email: string }[] = []
      for (const user of users) {
        const isAgent = config?.authorization?.isAgent ? await config.authorization.isAgent(user) : false
        const isAdmin = config?.authorization?.isAdmin ? await config.authorization.isAdmin(user) : false
        if (isAgent || isAdmin) {
          agents.push({ id: user.id, name: user.name ?? user.fullName ?? '', email: user.email ?? '' })
        }
      }
      return agents
    } catch {
      return []
    }
  }
}
