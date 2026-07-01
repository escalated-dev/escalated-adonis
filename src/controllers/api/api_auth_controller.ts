import type { HttpContext } from '@adonisjs/core/http'
import { getConfig } from '../../helpers/config.js'

type AuthCallback = (arg: any) => Promise<Record<string, any> | null> | Record<string, any> | null

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
    return this.delegate(ctx, getConfig().apiAuth?.authenticate, ctx.request.body())
  }

  /** POST /auth/register */
  async register(ctx: HttpContext) {
    return this.delegate(ctx, getConfig().apiAuth?.register, ctx.request.body())
  }

  /** POST /auth/refresh */
  async refresh(ctx: HttpContext) {
    return this.delegate(ctx, getConfig().apiAuth?.refresh, this.bearer(ctx))
  }

  /** GET /auth/me */
  async me(ctx: HttpContext) {
    return this.delegate(ctx, getConfig().apiAuth?.validate, this.bearer(ctx))
  }

  /** PATCH /auth/profile */
  async profile(ctx: HttpContext) {
    const callback = getConfig().apiAuth?.updateProfile
    if (!callback) {
      return this.notConfigured(ctx)
    }

    const result = await callback(this.bearer(ctx), ctx.request.body())
    if (!result) {
      return ctx.response.unauthorized({ error: 'Unauthorized' })
    }
    return ctx.response.json({ data: result })
  }

  /** POST /auth/logout */
  async logout(ctx: HttpContext) {
    const callback = getConfig().apiAuth?.logout
    if (callback) {
      await callback(this.bearer(ctx))
    }
    return ctx.response.json({ data: { success: true } })
  }

  private async delegate(ctx: HttpContext, callback: AuthCallback | undefined, arg: any) {
    if (!callback) {
      return this.notConfigured(ctx)
    }

    const result = await callback(arg ?? {})
    if (!result) {
      return ctx.response.unauthorized({ error: 'Unauthorized' })
    }
    return ctx.response.json({ data: result })
  }

  private notConfigured(ctx: HttpContext) {
    return ctx.response.notImplemented({ error: 'Authentication is not configured' })
  }

  private bearer(ctx: HttpContext): string {
    const header = ctx.request.header('authorization') ?? ''
    return header.startsWith('Bearer ') ? header.slice(7).trim() : header
  }
}
