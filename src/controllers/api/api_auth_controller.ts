import type { HttpContext } from '@adonisjs/core/http'

export default class ApiAuthController {
  /**
   * POST /auth/validate — Validate token and return user info
   */
  async validate(ctx: HttpContext) {
    const user = (ctx as any).auth?.user
    const apiToken = (ctx as any).apiToken

    const config = (globalThis as any).__escalated_config

    let isAgent = false
    let isAdmin = false

    if (config?.authorization?.isAgent) {
      isAgent = await config.authorization.isAgent(user)
    }
    if (config?.authorization?.isAdmin) {
      isAdmin = await config.authorization.isAdmin(user)
    }

    return ctx.response.json({
      user: {
        id: user.id,
        name: user.name ?? user.fullName ?? '',
        email: user.email ?? '',
      },
      abilities: apiToken.abilities ?? [],
      is_agent: isAgent,
      is_admin: isAdmin,
      token_name: apiToken.name,
      expires_at: apiToken.expiresAt?.toISO() ?? null,
    })
  }
}
