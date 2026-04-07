/*
|--------------------------------------------------------------------------
| RouteRegistrar
|--------------------------------------------------------------------------
|
| Reads the PluginManifest of each loaded SDK plugin and registers the
| appropriate AdonisJS routes for:
|
|   - Plugin data endpoints  →  /{prefix}/plugins/{name}/api/{method}/{path}
|   - Plugin webhook routes  →  /{prefix}/plugins/{name}/webhooks/{path}
|
| All endpoint routes are protected by the same admin middleware as the
| rest of the Escalated admin surface. Webhook routes are intentionally
| left open so external services can POST to them without authentication.
|
*/

import router from '@adonisjs/core/services/router'
import type { PluginManifest } from '@escalated-dev/plugin-sdk'
import type PluginBridge from './plugin_bridge.js'
import { getConfig } from '../helpers/config.js'

export default class RouteRegistrar {
  constructor(private readonly bridge: PluginBridge) {}

  /**
   * Register AdonisJS routes for every plugin manifest provided.
   */
  registerAll(manifests: Map<string, PluginManifest>): void {
    for (const [name, manifest] of manifests) {
      this.registerPlugin(name, manifest)
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private registerPlugin(name: string, manifest: PluginManifest): void {
    const config = getConfig()
    const prefix = config.routes?.prefix ?? 'support'
    const adminMiddleware = config.routes?.adminMiddleware ?? ['auth']

    const EnsureIsAdmin = () => import('../middleware/ensure_is_admin.js')

    // ---- Data endpoints (admin-authenticated) ----
    if (manifest.endpoints.length > 0) {
      router
        .group(() => {
          for (const ep of manifest.endpoints) {
            const method = ep.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'

            // Normalise path: strip leading slash so AdonisJS router doesn't
            // produce double-slashes
            const epPath = ep.path.replace(/^\/+/, '')

            ;(router[method] as Function)(`/${epPath}`, async (ctx: any) => {
              const response = await this.bridge.callEndpoint(name, ep.method, ep.path, {
                body: ctx.request.body(),
                params: ctx.params,
                query: ctx.request.qs(),
                headers: ctx.request.headers(),
              })
              return ctx.response.json(response)
            }).as(
              `escalated.plugin.${this.slugify(name)}.endpoint.${method}.${this.slugify(epPath)}`
            )
          }
        })
        .prefix(`${prefix}/plugins/${this.slugify(name)}/api`)
        .use([...adminMiddleware, EnsureIsAdmin])
    }

    // ---- Webhook routes (no authentication) ----
    if (manifest.webhooks.length > 0) {
      router
        .group(() => {
          for (const wh of manifest.webhooks) {
            const method = wh.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'

            const whPath = wh.path.replace(/^\/+/, '')

            ;(router[method] as Function)(`/${whPath}`, async (ctx: any) => {
              const response = await this.bridge.callWebhook(name, wh.method, wh.path, {
                body: ctx.request.body(),
                params: ctx.params,
                query: ctx.request.qs(),
                headers: ctx.request.headers(),
              })
              return ctx.response.json(response)
            }).as(
              `escalated.plugin.${this.slugify(name)}.webhook.${method}.${this.slugify(whPath)}`
            )
          }
        })
        .prefix(`${prefix}/plugins/${this.slugify(name)}/webhooks`)
    }
  }

  /**
   * Convert a plugin name or path segment to a safe route-name fragment.
   * e.g. "@escalated-dev/plugin-slack" → "escalated-dev--plugin-slack"
   */
  private slugify(value: string): string {
    return value
      .replace(/^@/, '')
      .replace(/\//g, '--')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .toLowerCase()
  }
}
