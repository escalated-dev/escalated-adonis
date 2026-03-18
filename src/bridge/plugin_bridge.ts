/*
|--------------------------------------------------------------------------
| PluginBridge
|--------------------------------------------------------------------------
|
| The core of the AdonisJS SDK plugin system. Unlike the Laravel bridge
| (which spawns a Node.js child process and communicates via JSON-RPC),
| the AdonisJS bridge loads SDK plugins IN-PROCESS via dynamic import().
|
| Lifecycle
| ─────────
| 1. boot()      — Called from EscalatedProvider.boot().
|                  Scans node_modules for @escalated-dev/plugin-* packages
|                  that export a ResolvedPlugin (created with definePlugin()).
|                  Each plugin is imported, a NativeContext is built for it,
|                  and the plugin's onActivate hook is called.
| 2. dispatchAction() / applyFilter()
|                — Forwarded to the Dispatcher which calls handlers directly.
| 3. callEndpoint() / callWebhook()
|                — Forwarded to the Dispatcher for a named plugin.
|
| No subprocess. No heartbeat. No restart logic. Errors in individual
| plugin handlers are caught and logged; they do not crash the bridge.
|
*/

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ResolvedPlugin, PluginManifest } from '@escalated-dev/plugin-sdk'
import Dispatcher from './dispatcher.js'
import NativeContext from './native_context.js'
import RouteRegistrar from './route_registrar.js'

export default class PluginBridge {
  private dispatcher: Dispatcher = new Dispatcher()
  private routeRegistrar: RouteRegistrar = new RouteRegistrar(this)

  /** name → manifest for every successfully loaded plugin */
  private manifests: Map<string, PluginManifest> = new Map()

  private booted = false
  private routesRegistered = false

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Boot the bridge.
   *
   * Discovers installed @escalated-dev/plugin-* packages, imports them,
   * wires up their PluginContext, calls onActivate(), and registers routes.
   *
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async boot(): Promise<void> {
    if (this.booted) return

    try {
      await this.loadInstalledPlugins()
      this.registerRoutes()
      this.booted = true

      console.info(
        `[Escalated Bridge] Booted. Loaded plugins: [${[...this.manifests.keys()].join(', ')}]`
      )
    } catch (err) {
      console.warn('[Escalated Bridge] Boot failed — SDK plugins disabled:', (err as Error).message)
    }
  }

  /**
   * Dispatch a fire-and-forget action hook to all loaded plugins.
   * Errors in individual plugin handlers are swallowed (logged by Dispatcher).
   */
  async dispatchAction(hook: string, event: unknown): Promise<void> {
    if (!this.booted) return
    await this.dispatcher.dispatchAction(hook, event)
  }

  /**
   * Apply a filter hook through all loaded plugins.
   * Returns the (possibly mutated) value, or the original on any error.
   */
  async applyFilter<T = unknown>(hook: string, value: T): Promise<T> {
    if (!this.booted) return value
    return this.dispatcher.applyFilter(hook, value)
  }

  /**
   * Call a plugin's data endpoint directly.
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
    return this.dispatcher.callEndpoint(pluginName, method, path, req)
  }

  /**
   * Call a plugin's webhook handler directly.
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
    return this.dispatcher.callWebhook(pluginName, method, path, req)
  }

  /**
   * Return the loaded manifests (name → manifest).
   */
  getManifests(): Map<string, PluginManifest> {
    return this.manifests
  }

  /**
   * Return whether the bridge has booted successfully.
   */
  isBooted(): boolean {
    return this.booted
  }

  // ---------------------------------------------------------------------------
  // Plugin discovery & loading
  // ---------------------------------------------------------------------------

  /**
   * Scan node_modules for packages whose name starts with
   * `@escalated-dev/plugin-` and whose default export is a ResolvedPlugin
   * (i.e. has `__escalated: true`).
   */
  private async loadInstalledPlugins(): Promise<void> {
    const candidates = this.discoverCandidates()

    for (const pkgPath of candidates) {
      await this.loadPlugin(pkgPath)
    }
  }

  /**
   * Walk node_modules and collect paths that look like
   * @escalated-dev/plugin-* packages.
   */
  private discoverCandidates(): string[] {
    const nodeModules = join(process.cwd(), 'node_modules')
    const candidates: string[] = []

    if (!existsSync(nodeModules)) return candidates

    // Check @escalated-dev scope
    const scopeDir = join(nodeModules, '@escalated-dev')
    if (existsSync(scopeDir)) {
      try {
        const entries = readdirSync(scopeDir)
        for (const entry of entries) {
          if (entry.startsWith('plugin-')) {
            candidates.push(join(scopeDir, entry))
          }
        }
      } catch {
        // scope directory not readable
      }
    }

    // Also support unscoped packages with name prefix escalated-plugin-
    try {
      const entries = readdirSync(nodeModules)
      for (const entry of entries) {
        if (entry.startsWith('escalated-plugin-')) {
          candidates.push(join(nodeModules, entry))
        }
      }
    } catch {
      // node_modules not readable
    }

    return candidates
  }

  /**
   * Import a single plugin package, validate its export, build its context,
   * register it with the Dispatcher, and call onActivate().
   */
  private async loadPlugin(pkgPath: string): Promise<void> {
    // Read package.json to get the module entry point
    const pkgJsonPath = join(pkgPath, 'package.json')
    if (!existsSync(pkgJsonPath)) return

    let pkgJson: Record<string, any>
    try {
      pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
    } catch {
      return
    }

    const packageName: string = pkgJson.name ?? pkgPath
    const mainEntry: string = pkgJson.main ?? pkgJson.exports?.['.' ] ?? 'index.js'

    // Resolve absolute path to the entry file
    const entryPath = join(pkgPath, mainEntry)
    if (!existsSync(entryPath)) return

    let pluginModule: any
    try {
      const fileUrl = `file:///${entryPath.replace(/\\/g, '/')}`
      pluginModule = await import(fileUrl)
    } catch (err) {
      console.warn(
        `[Escalated Bridge] Failed to import plugin "${packageName}":`,
        (err as Error).message
      )
      return
    }

    // Accept both `export default definePlugin(...)` and `export { plugin }`
    const resolved: ResolvedPlugin | undefined =
      pluginModule?.default?.__escalated === true
        ? pluginModule.default
        : pluginModule?.plugin?.__escalated === true
        ? pluginModule.plugin
        : undefined

    if (!resolved) {
      // Not an SDK plugin — skip silently
      return
    }

    // Build this plugin's NativeContext
    const context = new NativeContext(resolved.name, () => this.dispatcher)

    // Register with the dispatcher
    this.dispatcher.register(resolved, context)

    // Store the manifest
    this.manifests.set(resolved.name, resolved.toManifest())

    // Call onActivate lifecycle hook
    if (typeof resolved.onActivate === 'function') {
      try {
        await resolved.onActivate(context)
      } catch (err) {
        console.error(
          `[Escalated Bridge] onActivate failed for plugin "${resolved.name}":`,
          err
        )
      }
    }

    console.info(`[Escalated Bridge] Loaded plugin "${resolved.name}" v${resolved.version}`)
  }

  // ---------------------------------------------------------------------------
  // Route registration
  // ---------------------------------------------------------------------------

  private registerRoutes(): void {
    if (this.routesRegistered || this.manifests.size === 0) return
    this.routeRegistrar.registerAll(this.manifests)
    this.routesRegistered = true
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  /**
   * Call onDeactivate on all plugins and clear the dispatcher.
   * Called from EscalatedProvider.shutdown().
   */
  async shutdown(): Promise<void> {
    if (!this.booted) return

    for (const [name] of this.manifests) {
      const entry = (this.dispatcher as any).plugins?.find(
        (e: any) => e.plugin.name === name
      )
      if (!entry) continue

      if (typeof entry.plugin.onDeactivate === 'function') {
        try {
          await entry.plugin.onDeactivate(entry.context)
        } catch (err) {
          console.error(
            `[Escalated Bridge] onDeactivate failed for plugin "${name}":`,
            err
          )
        }
      }
    }

    this.dispatcher.clear()
    this.manifests.clear()
    this.booted = false
    this.routesRegistered = false
  }
}
