/*
|--------------------------------------------------------------------------
| RouteRegistrar
|--------------------------------------------------------------------------
|
| Reads the PluginManifest of each loaded SDK plugin and registers the
| appropriate AdonisJS routes for:
|
|   - Plugin admin pages     →  {METHOD} /{prefix}/admin/plugins/{slug}/{route}
|   - Plugin data endpoints  →  {METHOD} /{prefix}/api/plugins/{slug}{path}
|   - Plugin webhook routes  →  {METHOD} /{prefix}/webhooks/plugins/{slug}{path}
|
| These are the paths of domain-model/plugin-contract.md, as escalated-laravel
| and escalated-rails mount them. Pages and endpoints are protected by the
| same admin middleware as the rest of the Escalated admin surface. Webhook
| routes are intentionally left open so external services can POST to them
| without authentication. Routes exist for every installed plugin and answer
| 404 while it is inactive. Credentials are stripped from the headers a
| plugin sees, and a handler that throws is a 500 with a generic message.
|
*/

import defaultRouter from '@adonisjs/core/services/router'
import type { PageDeclaration, PluginManifest } from '@escalated-dev/plugin-sdk'
import { getRenderer } from '../rendering/renderer.js'
import type PluginBridge from './plugin_bridge.js'
import { getConfig } from '../helpers/config.js'
import { escalatedMiddleware, resolveConfiguredMiddleware } from '../support/route_middleware.js'
import { actingAs } from './native_context.js'

/** Headers a plugin never sees (domain-model/plugin-contract.md); also every `Proxy-*`. */
const STRIPPED_HEADERS = new Set(['cookie', 'authorization', 'x-xsrf-token', 'x-csrf-token'])

export default class RouteRegistrar {
  constructor(
    private readonly bridge: PluginBridge,
    private readonly router: typeof defaultRouter = defaultRouter
  ) {}

  /**
   * Register AdonisJS routes for every plugin manifest provided.
   */
  async registerAll(manifests: Map<string, PluginManifest>): Promise<void> {
    for (const [name, manifest] of manifests) {
      await this.registerPlugin(name, manifest)
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async registerPlugin(name: string, manifest: PluginManifest): Promise<void> {
    const router = this.router
    const config = getConfig()
    const prefix = config.routes?.prefix ?? 'support'
    const middleware = escalatedMiddleware(router)
    const adminMiddleware = await resolveConfiguredMiddleware(
      config.routes?.adminMiddleware ?? ['auth'],
      'routes.adminMiddleware'
    )

    // ---- Admin pages (admin-authenticated) ----
    // As escalated-laravel's RouteRegistrar::registerPages: each page renders
    // the shared Plugin/Page component. A declared `capability` is not checked
    // beyond admin access, as with this package's plugin endpoints.
    const pages = (manifest.pages ?? []).filter((page) => {
      const usable = Boolean(page.route?.replace(/^\/+/, '')) && Boolean(page.component)
      if (!usable) {
        console.warn(
          `[Escalated Bridge] Skipping a page of plugin "${name}" with no route or component.`
        )
      }
      return usable
    })
    if (pages.length > 0) {
      router
        .group(() => {
          for (const page of pages) {
            const pagePath = page.route.replace(/^\/+/, '')
            router
              .get(`/${pagePath}`, (ctx: any) => this.renderPage(ctx, name, page))
              .as(`escalated.plugin.${this.slugify(name)}.page.${this.slugify(pagePath)}`)
          }
        })
        .prefix(`${prefix}/admin/plugins/${this.slugify(name)}`)
        .use([...adminMiddleware, middleware.ensureIsAdmin(), middleware.requireTwoFactor()])
    }

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
              if (!(await this.bridge.isActive(name))) return this.notFound(ctx)
              // ctx writes act as the signed-in user of this request.
              return this.answer(ctx, name, 'endpoint', () =>
                actingAs(ctx.auth?.user ?? null, () =>
                  this.bridge.callEndpoint(name, ep.method, ep.path, this.pluginRequest(ctx))
                )
              )
            }).as(
              `escalated.plugin.${this.slugify(name)}.endpoint.${method}.${this.slugify(epPath)}`
            )
          }
        })
        .prefix(`${prefix}/api/plugins/${this.slugify(name)}`)
        .use([...adminMiddleware, middleware.ensureIsAdmin(), middleware.requireTwoFactor()])
    }

    // ---- Webhook routes (no authentication) ----
    if (manifest.webhooks.length > 0) {
      router
        .group(() => {
          for (const wh of manifest.webhooks) {
            const method = wh.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete'

            const whPath = wh.path.replace(/^\/+/, '')

            ;(router[method] as Function)(`/${whPath}`, async (ctx: any) => {
              if (!(await this.bridge.isActive(name))) return this.notFound(ctx)
              return this.answer(ctx, name, 'webhook', () =>
                actingAs(null, () =>
                  this.bridge.callWebhook(name, wh.method, wh.path, this.pluginRequest(ctx))
                )
              )
            }).as(
              `escalated.plugin.${this.slugify(name)}.webhook.${method}.${this.slugify(whPath)}`
            )
          }
        })
        .prefix(`${prefix}/webhooks/plugins/${this.slugify(name)}`)
    }
  }

  private notFound(ctx: any) {
    return ctx.response.notFound({ error: 'Not Found' })
  }

  /**
   * The request a plugin endpoint or webhook sees: body, route params, query
   * and headers, without the credentials of the person or service calling.
   */
  private pluginRequest(ctx: any) {
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(ctx.request.headers() ?? {})) {
      const lower = key.toLowerCase()
      if (STRIPPED_HEADERS.has(lower) || lower.startsWith('proxy-')) continue
      headers[key] = String(value)
    }
    return {
      body: ctx.request.body(),
      params: ctx.params,
      query: ctx.request.qs(),
      headers,
    }
  }

  /**
   * The plugin's answer as JSON, or a 500 with a generic message when the
   * handler throws: the error goes to the log, never to the client.
   */
  private async answer(ctx: any, name: string, kind: string, call: () => Promise<unknown>) {
    let response: unknown
    try {
      response = await call()
    } catch (error) {
      console.error(`[Escalated Bridge] Plugin "${name}" ${kind} failed:`, error)
      return ctx.response.status(500).json({ error: 'Plugin error' })
    }
    return ctx.response.json(response)
  }

  /**
   * Render a plugin page, with the props from the plugin's `GET /{component}`
   * endpoint when it has one, and none when it does not.
   */
  private async renderPage(ctx: any, name: string, page: PageDeclaration) {
    // Inactive plugins have no pages.
    if (!(await this.bridge.isActive(name))) return this.notFound(ctx)
    let props: unknown = {}
    try {
      props =
        (await this.bridge.callEndpoint(name, 'GET', `/${page.component}`, {
          params: ctx.params,
          query: ctx.request.qs(),
          headers: ctx.request.headers(),
        })) ?? {}
    } catch {
      // No endpoint for this page: it renders with empty props.
    }

    return getRenderer().render(ctx, 'Escalated/Plugin/Page', {
      plugin: name,
      component: page.component,
      layout: page.layout ?? 'admin',
      props,
    })
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
