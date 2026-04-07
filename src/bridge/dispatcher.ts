/*
|--------------------------------------------------------------------------
| Dispatcher
|--------------------------------------------------------------------------
|
| Drives plugin action and filter hooks for in-process SDK plugins.
|
| Unlike the Laravel bridge (which delegates over JSON-RPC to a Node.js
| subprocess), this dispatcher calls plugin handlers directly in the same
| Node.js process. Awaiting each handler is both safe and fast.
|
*/

import type { ResolvedPlugin } from '@escalated-dev/plugin-sdk'
import type { PluginContext } from '@escalated-dev/plugin-sdk'

interface RegistrationEntry {
  plugin: ResolvedPlugin
  context: PluginContext
}

export default class Dispatcher {
  /** Registered plugins in load order */
  private plugins: RegistrationEntry[] = []

  /**
   * Register a resolved plugin together with the PluginContext it should
   * receive whenever one of its handlers is invoked.
   */
  register(plugin: ResolvedPlugin, context: PluginContext): void {
    this.plugins.push({ plugin, context })
  }

  /**
   * Fire an action hook across all registered plugins.
   *
   * Plugins whose definition includes a handler for `hook` are called in
   * registration order (i.e. the order they were loaded). Errors thrown
   * by individual handlers are caught and logged so one bad plugin cannot
   * prevent subsequent handlers from running.
   */
  async dispatchAction(hook: string, event: unknown): Promise<void> {
    for (const { plugin, context } of this.plugins) {
      const handler = plugin.actions?.[hook]
      if (!handler) continue

      try {
        await handler(event, context)
      } catch (err) {
        console.error(
          `[Escalated Bridge] Action "${hook}" handler in plugin "${plugin.name}" threw:`,
          err
        )
      }
    }
  }

  /**
   * Apply a filter hook through all registered plugins.
   *
   * Filters are run in priority order (lowest priority number first). When
   * two plugins register the same hook at the same priority, load order
   * (registration order) is the tiebreaker.
   *
   * On error the current value is left unchanged and execution continues
   * with the next handler.
   */
  async applyFilter<T = unknown>(hook: string, value: T): Promise<T> {
    // Collect all handlers for this hook with their priorities
    type Entry = { priority: number; plugin: ResolvedPlugin; context: PluginContext }
    const entries: Entry[] = []

    for (const { plugin, context } of this.plugins) {
      const filterReg = plugin._normalizedFilters?.[hook]
      if (!filterReg) continue
      entries.push({ priority: filterReg.priority ?? 10, plugin, context })
    }

    // Stable-sort by priority
    entries.sort((a, b) => a.priority - b.priority)

    let result: T = value
    for (const { plugin, context } of entries) {
      const filterReg = plugin._normalizedFilters![hook]!
      try {
        result = (await filterReg.handler(result, context)) as T
      } catch (err) {
        console.error(
          `[Escalated Bridge] Filter "${hook}" handler in plugin "${plugin.name}" threw:`,
          err
        )
      }
    }

    return result
  }

  /**
   * Call a named endpoint handler on a specific plugin.
   *
   * The key format follows the SDK convention: `"METHOD /path"`,
   * e.g. `"GET /reports"` or `"POST /webhooks/stripe"`.
   *
   * Throws if the plugin or endpoint is not found.
   */
  async callEndpoint(
    pluginName: string,
    method: string,
    path: string,
    req: {
      body?: unknown
      params?: Record<string, string>
      query?: Record<string, string>
      headers?: Record<string, string>
    }
  ): Promise<unknown> {
    const entry = this.findPlugin(pluginName)
    const key = `${method.toUpperCase()} ${path}`
    const endpoint = entry.plugin._normalizedEndpoints?.[key]

    if (!endpoint) {
      throw new Error(`[Escalated Bridge] Endpoint "${key}" not found in plugin "${pluginName}"`)
    }

    return endpoint.handler(entry.context, {
      body: req.body ?? null,
      params: req.params ?? {},
      query: req.query ?? {},
      headers: req.headers ?? {},
    })
  }

  /**
   * Call a named webhook handler on a specific plugin.
   */
  async callWebhook(
    pluginName: string,
    method: string,
    path: string,
    req: {
      body?: unknown
      params?: Record<string, string>
      query?: Record<string, string>
      headers?: Record<string, string>
    }
  ): Promise<unknown> {
    const entry = this.findPlugin(pluginName)
    const key = `${method.toUpperCase()} ${path}`
    const handler = entry.plugin.webhooks?.[key]

    if (!handler) {
      throw new Error(`[Escalated Bridge] Webhook "${key}" not found in plugin "${pluginName}"`)
    }

    return handler(entry.context, {
      body: req.body ?? null,
      params: req.params ?? {},
      query: req.query ?? {},
      headers: req.headers ?? {},
    })
  }

  /**
   * Return the names of all registered plugins.
   */
  getPluginNames(): string[] {
    return this.plugins.map((e) => e.plugin.name)
  }

  /**
   * Clear all registered plugins. Useful for testing or hot-reload scenarios.
   */
  clear(): void {
    this.plugins = []
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private findPlugin(pluginName: string): RegistrationEntry {
    const entry = this.plugins.find((e) => e.plugin.name === pluginName)
    if (!entry) {
      throw new Error(`[Escalated Bridge] Plugin "${pluginName}" is not registered`)
    }
    return entry
  }
}
