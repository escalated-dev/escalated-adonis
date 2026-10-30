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
|                  Each plugin is imported and a NativeContext is built for
|                  it. Its onActivate runs when an admin activates it.
|                  Only active plugins (escalated_plugins) are dispatched to.
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
import NativeContext, { actingAs } from './native_context.js'
import RouteRegistrar from './route_registrar.js'
import { cronDue } from '../support/plugin_cron.js'
import {
  activeSdkPluginNames,
  isSdkPluginActive,
  recordInstalledSdkPlugins,
} from './sdk_plugin_activation.js'

/** domain-model/plugin-contract.md: cron runs under the action timeout, badges the filter one. */
const CRON_TIMEOUT_MS = 30_000
const BADGE_TIMEOUT_MS = 5_000

function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms)
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

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
      await recordInstalledSdkPlugins([...this.manifests.keys()])
      await this.registerRoutes()
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
    const active = await this.activeNames()
    if (active.size === 0) return
    await this.dispatcher.dispatchAction(hook, event, active)
  }

  /** The names of the active SDK plugins. */
  async activeNames(): Promise<Set<string>> {
    return new Set(await activeSdkPluginNames(this.manifests.keys()))
  }

  /** Whether a loaded SDK plugin is active. */
  async isActive(pluginName: string): Promise<boolean> {
    return this.manifests.has(pluginName) && (await isSdkPluginActive(pluginName))
  }

  /**
   * Call a plugin's onActivate (after it is recorded active) or onDeactivate
   * (while it still is). A throwing callback is logged, never thrown: it does
   * not undo the transition.
   */
  async activate(pluginName: string): Promise<void> {
    await this.lifecycle(pluginName, 'onActivate')
  }

  async deactivate(pluginName: string): Promise<void> {
    await this.lifecycle(pluginName, 'onDeactivate')
  }

  private async lifecycle(pluginName: string, callback: 'onActivate' | 'onDeactivate') {
    try {
      await this.dispatcher.lifecycle(pluginName, callback)
    } catch (err) {
      console.error(`[Escalated Bridge] ${callback} failed for plugin "${pluginName}":`, err)
    }
  }

  /**
   * Apply a filter hook through all loaded plugins.
   * Returns the (possibly mutated) value, or the original on any error.
   */
  async applyFilter<T = unknown>(hook: string, value: T): Promise<T> {
    if (!this.booted) return value
    const active = await this.activeNames()
    if (active.size === 0) return value
    return this.dispatcher.applyFilter(hook, value, active)
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
    await this.assertActive(pluginName)
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
    await this.assertActive(pluginName)
    return this.dispatcher.callWebhook(pluginName, method, path, req)
  }

  /** An inactive plugin's endpoints, webhooks and pages do not exist. */
  private async assertActive(pluginName: string): Promise<void> {
    if (!(await this.isActive(pluginName))) {
      throw Object.assign(new Error(`Plugin "${pluginName}" is not active`), { status: 404 })
    }
  }

  /**
   * Run every cron schedule of every loaded SDK plugin that is due in the
   * minute of `at` (UTC), one after another, as no user, each within 30 s.
   * A failing, slow or unreadable schedule is logged and never stops the
   * others. Returns how many ran.
   */
  async runDueCron(at: Date): Promise<number> {
    if (!this.booted) return 0
    let ran = 0
    // Inactive plugins run no cron.
    const active = await this.activeNames()
    for (const [name, manifest] of this.manifests) {
      if (!active.has(name)) continue
      for (const schedule of manifest.cronSchedules ?? []) {
        let due: boolean
        try {
          due = cronDue(schedule, at)
        } catch (err) {
          console.warn(
            `[Escalated Bridge] ${name} cron "${schedule}" skipped:`,
            (err as Error).message
          )
          continue
        }
        if (!due) continue
        ran++
        try {
          await actingAs(null, () =>
            withTimeout(
              this.dispatcher.runCron(name, schedule),
              CRON_TIMEOUT_MS,
              `cron "${schedule}"`
            )
          )
        } catch (err) {
          console.error(`[Escalated Bridge] ${name} cron "${schedule}" failed:`, err)
        }
      }
    }
    return ran
  }

  /**
   * A widget's badge, asked as `viewer` within 5 s: a number or a string, or
   * null when the plugin fails, is slow or answers anything else.
   */
  async widgetBadge(
    pluginName: string,
    component: string,
    viewer: unknown
  ): Promise<number | string | null> {
    try {
      if (!(await this.isActive(pluginName))) return null
      const answer = await actingAs(viewer, () =>
        withTimeout(
          this.dispatcher.badge(pluginName, component),
          BADGE_TIMEOUT_MS,
          `badge ${component}`
        )
      )
      return typeof answer === 'number' || typeof answer === 'string' ? answer : null
    } catch (err) {
      console.warn(
        `[Escalated Bridge] ${pluginName} badge ${component} failed:`,
        (err as Error).message
      )
      return null
    }
  }

  /**
   * Register an SDK plugin object (what `definePlugin()` returns): build its
   * context, add it to the dispatcher, keep its manifest and call
   * onActivate(). Installed packages are registered this way at boot.
   */
  async register(resolved: ResolvedPlugin): Promise<void> {
    const context = new NativeContext(resolved.name, () => this.dispatcher)
    this.dispatcher.register(resolved, context)
    this.manifests.set(resolved.name, resolved.toManifest())
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
    const mainEntry: string = pkgJson.main ?? pkgJson.exports?.['.'] ?? 'index.js'

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

    await this.register(resolved)

    console.info(`[Escalated Bridge] Loaded plugin "${resolved.name}" v${resolved.version}`)
  }

  // ---------------------------------------------------------------------------
  // Route registration
  // ---------------------------------------------------------------------------

  private async registerRoutes(): Promise<void> {
    if (this.routesRegistered || this.manifests.size === 0) return
    await this.routeRegistrar.registerAll(this.manifests)
    this.routesRegistered = true
  }

  // ---------------------------------------------------------------------------
  // Shutdown
  // ---------------------------------------------------------------------------

  /**
   * Clear the dispatcher. Called from EscalatedProvider.shutdown(). Stopping
   * the process is not deactivation: onDeactivate runs only when an admin
   * deactivates a plugin.
   */
  async shutdown(): Promise<void> {
    if (!this.booted) return

    this.dispatcher.clear()
    this.manifests.clear()
    this.booted = false
    this.routesRegistered = false
  }
}
