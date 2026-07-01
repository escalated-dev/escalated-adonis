import type { HttpContext } from '@adonisjs/core/http'
import { getConfig } from '../../helpers/config.js'
import { bearerToken, runAuthCallback } from '../../helpers/api_auth.js'

/**
 * General JSON API authentication for the Flutter app. login/register/refresh/
 * logout/me/profile delegate to host-app callbacks (config.apiAuth.*) —
 * Escalated owns no passwords or sessions. An unconfigured callback responds
 * 501; a callback returning null is an auth failure (401). The existing
 * `validate` endpoint continues to use the built-in API-token middleware.
 */
export default class ApiAuthController {
  /**
   * POST /auth/validate — Validate token and return user info.
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

  /** POST /auth/login */
  async login(ctx: HttpContext) {
    const { status, body } = await runAuthCallback(
      getConfig().apiAuth?.authenticate,
      ctx.request.body()
    )
    return ctx.response.status(status).json(body)
  }

  /** POST /auth/register */
  async register(ctx: HttpContext) {
    const { status, body } = await runAuthCallback(
      getConfig().apiAuth?.register,
      ctx.request.body()
    )
    return ctx.response.status(status).json(body)
  }

  /** POST /auth/refresh */
  async refresh(ctx: HttpContext) {
    const { status, body } = await runAuthCallback(
      getConfig().apiAuth?.refresh,
      bearerToken(ctx.request.header('authorization'))
    )
    return ctx.response.status(status).json(body)
  }

  /** GET /auth/me */
  async me(ctx: HttpContext) {
    const { status, body } = await runAuthCallback(
      getConfig().apiAuth?.validate,
      bearerToken(ctx.request.header('authorization'))
    )
    return ctx.response.status(status).json(body)
  }

  /** PATCH /auth/profile */
  async profile(ctx: HttpContext) {
    const callback = getConfig().apiAuth?.updateProfile
    const wrapped = callback
      ? (attrs: any) => callback(bearerToken(ctx.request.header('authorization')), attrs)
      : undefined
    const { status, body } = await runAuthCallback(wrapped, ctx.request.body())
    return ctx.response.status(status).json(body)
  }

  /** POST /auth/logout */
  async logout(ctx: HttpContext) {
    const callback = getConfig().apiAuth?.logout
    if (callback) {
      await callback(bearerToken(ctx.request.header('authorization')))
    }
    return ctx.response.json({ data: { success: true } })
  }
}
