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
import PluginService from '../services/plugin_service.js'
import HookManager from '../support/hook_manager.js'

export default class AdminPluginsController {
  protected getPluginService(): PluginService {
    const hookManager: HookManager = (globalThis as any).__escalated_hooks
    return new PluginService(hookManager)
  }

  /**
   * GET /support/admin/plugins — List all installed plugins
   */
  async index({ inertia }: HttpContext) {
    const pluginService = this.getPluginService()
    const plugins = await pluginService.getAllPlugins()

    return inertia.render('Escalated/Admin/Plugins/Index', {
      plugins,
    })
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
      return ctx.response.redirect().toRoute('escalated.admin.plugins.index')
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
      console.error('[Escalated] Plugin activation failed:', error)
      ctx.session.flash('error', `Failed to activate plugin: ${error.message}`)
    }

    return ctx.response.redirect().back()
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
      console.error('[Escalated] Plugin deactivation failed:', error)
      ctx.session.flash('error', `Failed to deactivate plugin: ${error.message}`)
    }

    return ctx.response.redirect().back()
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
      ctx.session.flash('error', 'npm plugins cannot be deleted. Remove the package via npm instead.')
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
