import type { HttpContext } from '@adonisjs/core/http'
import Department from '../../models/department.js'
import Tag from '../../models/tag.js'
import CannedResponse from '../../models/canned_response.js'
import Macro from '../../models/macro.js'

export default class ApiResourceController {
  /**
   * GET /agents — List all users who are agents or admins
   */
  async agents(ctx: HttpContext) {
    const agents = await this.getAgents()

    return ctx.response.json({
      data: agents.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
      })),
    })
  }

  /**
   * GET /departments — List active departments
   */
  async departments(ctx: HttpContext) {
    const departments = await Department.query()
      .withScopes((scopes) => scopes.active())

    return ctx.response.json({
      data: departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        is_active: d.isActive,
      })),
    })
  }

  /**
   * GET /tags — List all tags
   */
  async tags(ctx: HttpContext) {
    const tags = await Tag.query()

    return ctx.response.json({
      data: tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
      })),
    })
  }

  /**
   * GET /canned-responses — List canned responses for the authenticated agent
   */
  async cannedResponses(ctx: HttpContext) {
    const userId = (ctx as any).auth.user.id

    const responses = await CannedResponse.query()
      .withScopes((scopes) => scopes.forAgent(userId))

    return ctx.response.json({
      data: responses.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
      })),
    })
  }

  /**
   * GET /macros — List macros for the authenticated agent
   */
  async macros(ctx: HttpContext) {
    const userId = (ctx as any).auth.user.id

    const macros = await Macro.query()
      .withScopes((scopes) => scopes.forAgent(userId))
      .orderBy('order')

    return ctx.response.json({
      data: macros.map((m) => ({
        id: m.id,
        name: m.name,
        actions: m.actions,
        order: m.order,
      })),
    })
  }

  /**
   * GET /realtime/config — Return WebSocket configuration if available
   */
  async realtimeConfig(ctx: HttpContext) {
    // In Adonis, broadcasting config would need to come from the host app
    // Return null if not configured
    return ctx.response.json(null)
  }

  // ---- Private Helpers ----

  /**
   * Get all users who pass the agent or admin gate.
   */
  protected async getAgents(): Promise<{ id: number; name: string; email: string }[]> {
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
