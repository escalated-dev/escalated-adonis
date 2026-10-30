/*
|--------------------------------------------------------------------------
| AdminPluginsController
|--------------------------------------------------------------------------
|
| Admin CRUD for the plugin system. Lists installed plugins, handles
| upload/activation/deactivation/deletion.
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import PluginService, { UnknownPluginError } from '../services/plugin_service.js'
import type { PluginInfo } from '../types.js'
import type HookManager from '../support/hook_manager.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'

export default class AdminPluginsController {
  protected getPluginService(): PluginService {
    const hookManager: HookManager = (globalThis as any).__escalated_hooks
    return new PluginService(hookManager)
  }

  /**
   * GET /support/admin/plugins — List all installed plugins
   */
  async index(ctx: HttpContext) {
    const pluginService = this.getPluginService()
    const plugins = await pluginService.getAllPlugins()

    return getRenderer().render(ctx, 'Escalated/Admin/Plugins/Index', {
      plugins: plugins.map((plugin) => this.pluginObject(plugin)),
      can_upload: true,
    })
  }

  /** The plugin contract's plugin object (snake_case, as the page reads it). */
  protected pluginObject(plugin: PluginInfo) {
    return {
      slug: plugin.slug,
      name: plugin.name,
      description: plugin.description ?? null,
      version: plugin.version,
      author: plugin.author ?? null,
      author_url: plugin.authorUrl || null,
      homepage: plugin.homepage ?? (plugin.authorUrl || null),
      is_active: plugin.isActive,
      activated_at: plugin.activatedAt,
      source: plugin.source,
      ...(plugin.provides ? { provides: plugin.provides } : {}),
    }
  }

  /** Plugin transitions answer with a 303 to the index (the Inertia protocol). */
  protected toIndex(ctx: HttpContext) {
    const redirect = ctx.response.redirect() as unknown as {
      status(code: number): { toRoute(name: string): void }
    }
    return redirect.status(303).toRoute('escalated.admin.plugins.index')
  }

  /** An unknown slug: an `error` flash, or a 404 for a JSON request. */
  protected unknown(ctx: HttpContext, error: UnknownPluginError) {
    if (!ctx.request.header('x-inertia') && ctx.request.accepts(['html', 'json']) === 'json') {
      return ctx.response.notFound({ error: error.message })
    }
    ctx.session.flash('error', error.message)
    return this.toIndex(ctx)
  }

  /**
   * POST /support/admin/plugins/upload — Upload a plugin ZIP
   */
  async upload(ctx: HttpContext) {
    const file = ctx.request.file('plugin', {
      extnames: ['zip'],
      size: '50mb',
    })

    if (!file || file.hasErrors) {
      ctx.session.flash('error', file?.errors?.[0]?.message ?? 'Invalid plugin file.')
      return ctx.response.redirect().back()
    }

    try {
      const pluginService = this.getPluginService()
      await pluginService.uploadPlugin(file)

      ctx.session.flash('success', 'Plugin uploaded successfully. You can now activate it.')
      return redirectToRoute(ctx.response, 'escalated.admin.plugins.index')
    } catch (error: any) {
      console.error('[Escalated] Plugin upload failed:', error)
      ctx.session.flash('error', `Failed to upload plugin: ${error.message}`)
      return ctx.response.redirect().back()
    }
  }

  /**
   * POST /support/admin/plugins/:slug/activate — Activate a plugin
   */
  async activate(ctx: HttpContext) {
    const slug = ctx.params.slug

    try {
      const pluginService = this.getPluginService()
      await pluginService.activatePlugin(slug)

      ctx.session.flash('success', 'Plugin activated successfully.')
    } catch (error: any) {
      if (error instanceof UnknownPluginError) return this.unknown(ctx, error)
      console.error('[Escalated] Plugin activation failed:', error)
      ctx.session.flash('error', `Failed to activate plugin: ${error.message}`)
    }

    return this.toIndex(ctx)
  }

  /**
   * POST /support/admin/plugins/:slug/deactivate — Deactivate a plugin
   */
  async deactivate(ctx: HttpContext) {
    const slug = ctx.params.slug

    try {
      const pluginService = this.getPluginService()
      await pluginService.deactivatePlugin(slug)

      ctx.session.flash('success', 'Plugin deactivated successfully.')
    } catch (error: any) {
      if (error instanceof UnknownPluginError) return this.unknown(ctx, error)
      console.error('[Escalated] Plugin deactivation failed:', error)
      ctx.session.flash('error', `Failed to deactivate plugin: ${error.message}`)
    }

    return this.toIndex(ctx)
  }

  /**
   * DELETE /support/admin/plugins/:slug — Delete a plugin
   */
  async destroy(ctx: HttpContext) {
    const slug = ctx.params.slug

    // Check if plugin is npm-sourced before attempting delete
    const allPlugins = await this.getPluginService().getAllPlugins()
    const pluginData = allPlugins.find((p: any) => p.slug === ctx.params.slug)
    if (pluginData && pluginData.source === 'composer') {
      ctx.session.flash(
        'error',
        'npm plugins cannot be deleted. Remove the package via npm instead.'
      )
      return ctx.response.redirect().back()
    }

    try {
      const pluginService = this.getPluginService()
      const deleted = await pluginService.deletePlugin(slug)

      if (deleted) {
        ctx.session.flash('success', 'Plugin deleted successfully.')
      } else {
        ctx.session.flash('error', 'Plugin not found.')
      }
    } catch (error: any) {
      console.error('[Escalated] Plugin deletion failed:', error)
      ctx.session.flash('error', `Failed to delete plugin: ${error.message}`)
    }

    return ctx.response.redirect().back()
  }
}
