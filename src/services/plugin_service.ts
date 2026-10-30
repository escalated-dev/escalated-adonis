/*
|--------------------------------------------------------------------------
| PluginService
|--------------------------------------------------------------------------
|
| Handles plugin discovery, activation, deactivation, deletion, upload,
| and boot-time loading. Plugins live in the HOST APPLICATION's filesystem
| at a configurable path (default: plugins/escalated).
|
*/

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getConfig } from '../helpers/config.js'
import Plugin from '../models/plugin.js'
import type HookManager from '../support/hook_manager.js'
import { collectSafeArchiveRootFolder, resolveWithinBasePath } from '../support/plugin_archive.js'
import type { PluginManifest, PluginInfo } from '../types.js'
import { sdkPluginSlug } from '../bridge/sdk_plugin_activation.js'

/** No native or SDK plugin has this slug. */
export class UnknownPluginError extends Error {
  constructor(public readonly slug: string) {
    super(`No plugin is installed as "${slug}".`)
  }
}

export default class PluginService {
  protected pluginsPath: string
  protected hookManager: HookManager

  constructor(hookManager: HookManager) {
    this.hookManager = hookManager

    const config = getConfig()
    const configuredPath = (config as any).plugins?.path ?? 'app/plugins/escalated'
    this.pluginsPath = resolve(process.cwd(), configuredPath)

    // Ensure the plugins directory exists
    if (!existsSync(this.pluginsPath)) {
      mkdirSync(this.pluginsPath, { recursive: true })
    }
  }

  /**
   * Merge local and npm-sourced plugins.
   * Returns metadata for every installed plugin.
   */
  async getAllPlugins(): Promise<PluginInfo[]> {
    const local = await this.getLocalPlugins()
    const npm = await this.getNpmPlugins()
    const native = [...local, ...npm]
    const taken = new Set(native.map((p) => p.slug))
    const sdkPlugins = await this.getSdkPlugins()
    const sdk = sdkPlugins.filter((plugin) => {
      if (!taken.has(plugin.slug)) return true
      console.error(
        `[Escalated] SDK plugin "${plugin.name}" and a native plugin share the slug "${plugin.slug}"; the SDK plugin is not listed.`
      )
      return false
    })
    return [...native, ...sdk]
  }

  /**
   * SDK plugins the bridge loaded, listed with the native ones. npm installs
   * them, so their source is `composer` (managed by a package manager) and
   * the admin cannot delete them.
   */
  private async getSdkPlugins(): Promise<PluginInfo[]> {
    const manifests = this.sdkManifests()
    if (manifests.size === 0) return []
    let rows: Plugin[] = []
    try {
      rows = await Plugin.query().whereIn(
        'slug',
        [...manifests.keys()].map((name) => sdkPluginSlug(name))
      )
    } catch {}
    const bySlug = new Map(rows.map((row) => [row.slug, row]))

    return [...manifests].map(([name, manifest]: [string, any]) => {
      const slug = sdkPluginSlug(name)
      const row = bySlug.get(slug)
      const pages: any[] = manifest?.pages ?? []
      return {
        slug,
        name,
        description: manifest?.description ?? null,
        version: String(manifest?.version ?? '0.0.0'),
        author: manifest?.author ?? null,
        authorUrl: manifest?.homepage ?? null,
        homepage: manifest?.homepage ?? null,
        requires: '',
        mainFile: '',
        isActive: row?.isActive ?? false,
        activatedAt: row?.isActive ? (row.activatedAt?.toISO() ?? null) : null,
        path: '',
        source: 'composer',
        sdk: true,
        provides: {
          menu_items: pages.filter((page) => page?.menu && typeof page.menu === 'object').length,
          widgets: (manifest?.widgets ?? []).length,
          page_components: (manifest?.components ?? []).length,
        },
      } as PluginInfo
    })
  }

  private sdkBridge(): any {
    const bridge = (globalThis as any).__escalated_pluginBridge
    return bridge?.isBooted?.() ? bridge : null
  }

  private sdkManifests(): Map<string, any> {
    return this.sdkBridge()?.getManifests?.() ?? new Map()
  }

  /** The SDK plugin name behind a slug, or null. */
  private sdkPluginName(slug: string): string | null {
    for (const name of this.sdkManifests().keys()) {
      if (sdkPluginSlug(name) === slug) return name
    }
    return null
  }

  private async nativePluginName(slug: string): Promise<string> {
    const path = await this.resolvePluginPath(slug)
    try {
      const manifest = path ? JSON.parse(readFileSync(join(path, 'plugin.json'), 'utf-8')) : null
      if (typeof manifest?.name === 'string') return manifest.name
    } catch {}
    return slug
  }

  /**
   * Fire a lifecycle action (`plugin.activated` and so on) with
   * `{plugin, slug}` to active native and SDK plugins. A plugin that throws
   * is logged and never undoes the transition.
   */
  private async fireLifecycle(hook: string, slug: string, sdkName: string | null) {
    const data = { plugin: sdkName ?? (await this.nativePluginName(slug)), slug }
    try {
      await this.hookManager?.doAction(hook, data)
    } catch (err) {
      console.error(`[Escalated] plugin action "${hook}" failed:`, err)
    }
    try {
      await this.sdkBridge()?.dispatchAction(hook, data)
    } catch (err) {
      console.error(`[Escalated] SDK plugin action "${hook}" failed:`, err)
    }
  }

  /**
   * Scan the local plugins directory and merge with DB activation state.
   */
  private async getLocalPlugins(): Promise<PluginInfo[]> {
    const plugins: PluginInfo[] = []

    let directories: string[]
    try {
      directories = readdirSync(this.pluginsPath).filter((entry) => {
        const fullPath = join(this.pluginsPath, entry)
        return statSync(fullPath).isDirectory()
      })
    } catch {
      return plugins
    }

    for (const dirName of directories) {
      const manifestPath = join(this.pluginsPath, dirName, 'plugin.json')

      if (!existsSync(manifestPath)) {
        continue
      }

      try {
        const raw = readFileSync(manifestPath, 'utf-8')
        const manifest: PluginManifest = JSON.parse(raw)

        // Merge with DB state
        const dbPlugin = await Plugin.query().where('slug', dirName).first()

        plugins.push({
          slug: dirName,
          name: manifest.name ?? dirName,
          description: manifest.description ?? '',
          version: manifest.version ?? '1.0.0',
          author: manifest.author ?? 'Unknown',
          authorUrl: manifest.author_url ?? '',
          requires: manifest.requires ?? '1.0.0',
          mainFile: manifest.main_file ?? 'Plugin.ts',
          isActive: dbPlugin?.isActive ?? false,
          activatedAt: dbPlugin?.activatedAt?.toISO() ?? null,
          path: join(this.pluginsPath, dirName),
          source: 'local',
        })
      } catch {
        // Skip plugins with invalid manifests
        continue
      }
    }

    return plugins
  }

  /**
   * Discover plugins installed via npm (node_modules), including scoped packages.
   */
  private async getNpmPlugins(): Promise<PluginInfo[]> {
    const plugins: PluginInfo[] = []
    const nodeModulesPath = join(process.cwd(), 'node_modules')

    try {
      if (!existsSync(nodeModulesPath)) return plugins

      // Scan node_modules for packages with plugin.json (including scoped packages)
      const entries = readdirSync(nodeModulesPath)
      const dirsToCheck: string[] = []

      for (const entry of entries) {
        const entryPath = join(nodeModulesPath, entry)
        if (entry.startsWith('@') && existsSync(entryPath)) {
          // Scoped package — check subdirectories
          const scopedEntries = readdirSync(entryPath)
          for (const sub of scopedEntries) {
            dirsToCheck.push(join(entryPath, sub))
          }
        } else if (entry !== '.package-lock.json' && !entry.startsWith('.')) {
          dirsToCheck.push(entryPath)
        }
      }

      for (const dir of dirsToCheck) {
        const manifestPath = join(dir, 'plugin.json')
        if (!existsSync(manifestPath)) continue

        try {
          const raw = readFileSync(manifestPath, 'utf-8')
          const manifest = JSON.parse(raw)
          if (!manifest) continue

          // Derive slug from package directory name
          const parts = dir.replace(/\\/g, '/').split('/')
          const lastTwo = parts.slice(-2)
          const slug = lastTwo[0].startsWith('@') ? lastTwo.join('--') : parts[parts.length - 1]

          let dbPlugin = null
          try {
            dbPlugin = await Plugin.query().where('slug', slug).first()
          } catch {}

          plugins.push({
            slug,
            name: manifest.name || slug,
            description: manifest.description || '',
            version: manifest.version || '1.0.0',
            author: manifest.author || 'Unknown',
            authorUrl: manifest.author_url || '',
            requires: manifest.requires || '1.0.0',
            mainFile: manifest.main_file || 'Plugin.js',
            isActive: dbPlugin?.isActive || false,
            activatedAt: dbPlugin?.activatedAt?.toISO() || null,
            path: dir,
            source: 'composer', // Use 'composer' for frontend consistency
          })
        } catch {
          // Skip invalid manifests
        }
      }
    } catch (error) {
      // node_modules scan failed, non-fatal
    }

    return plugins
  }

  /**
   * Return the slugs of all currently activated plugins.
   */
  async getActivatedPlugins(): Promise<string[]> {
    try {
      const activePlugins = await Plugin.query()
        .withScopes((scopes) => scopes.active())
        .select('slug')

      return activePlugins.map((p) => p.slug)
    } catch {
      // Table may not exist yet (before migrations)
      return []
    }
  }

  /**
   * Activate a plugin (domain-model/plugin-contract.md, Lifecycle): record it
   * active, let it set itself up (native: load it and fire plugin_activated;
   * SDK: its onActivate), then fire `plugin.activated`. Activating an active
   * plugin does nothing. Throws UnknownPluginError for an unknown slug.
   */
  async activatePlugin(slug: string): Promise<boolean> {
    const sdkName = this.sdkPluginName(slug)
    if (sdkName) return this.activateSdkPlugin(slug, sdkName)

    // Verify plugin directory and manifest exist (check both local and npm sources)
    const pluginPath = await this.resolvePluginPath(slug)
    if (!pluginPath || !existsSync(join(pluginPath, 'plugin.json'))) {
      throw new UnknownPluginError(slug)
    }

    let plugin = await Plugin.query().where('slug', slug).first()

    if (!plugin) {
      plugin = await Plugin.create({
        slug,
        isActive: false,
      })
    }

    if (!plugin.isActive) {
      plugin.isActive = true
      const { DateTime: LuxonDateTime } = await import('luxon')
      plugin.activatedAt = LuxonDateTime.now()
      plugin.deactivatedAt = null
      await plugin.save()

      // Load the plugin so its hooks are registered
      await this.loadPlugin(slug)

      // Fire activation hooks
      await this.hookManager.doAction('plugin_activated', slug)
      await this.hookManager.doAction(`plugin_activated_${slug}`)
      await this.fireLifecycle('plugin.activated', slug, null)
    }

    return true
  }

  private async activateSdkPlugin(slug: string, name: string): Promise<boolean> {
    const { DateTime } = await import('luxon')
    let plugin = await Plugin.query().where('slug', slug).first()
    if (plugin?.isActive) return true

    plugin ??= new Plugin()
    plugin.slug = slug
    plugin.isActive = true
    plugin.activatedAt = DateTime.now()
    plugin.deactivatedAt = null
    await plugin.save()

    await this.sdkBridge()?.activate(name)
    await this.fireLifecycle('plugin.activated', slug, name)
    return true
  }

  /**
   * Deactivate a plugin: fire `plugin.deactivated` and let it clean up while
   * it is still active, then record it inactive. Throws UnknownPluginError
   * for an unknown slug.
   */
  async deactivatePlugin(slug: string): Promise<boolean> {
    const sdkName = this.sdkPluginName(slug)
    const plugin = await Plugin.query().where('slug', slug).first()
    if (!plugin && !sdkName && !(await this.resolvePluginPath(slug))) {
      throw new UnknownPluginError(slug)
    }

    if (plugin && plugin.isActive && sdkName) {
      await this.fireLifecycle('plugin.deactivated', slug, sdkName)
      await this.sdkBridge()?.deactivate(sdkName)
    } else if (plugin && plugin.isActive) {
      await this.fireLifecycle('plugin.deactivated', slug, null)
      // Fire deactivation hooks BEFORE deactivating
      await this.hookManager.doAction('plugin_deactivated', slug)
      await this.hookManager.doAction(`plugin_deactivated_${slug}`)
    }

    if (plugin && plugin.isActive) {
      plugin.isActive = false
      const { DateTime: LuxonDt } = await import('luxon')
      plugin.deactivatedAt = LuxonDt.now()
      await plugin.save()
    }

    return true
  }

  /**
   * Delete a plugin: fire uninstall hooks, deactivate, remove DB record,
   * and delete the plugin directory from disk.
   */
  async deletePlugin(slug: string): Promise<boolean> {
    const allPlugins = await this.getAllPlugins()
    const pluginData = allPlugins.find((p) => p.slug === slug)
    if (pluginData && pluginData.source === 'composer') {
      throw new Error(
        pluginData.sdk
          ? 'SDK plugins are installed with npm. Remove the package with npm instead.'
          : 'npm plugins cannot be deleted. Remove the package via npm instead.'
      )
    }

    const pluginPath = join(this.pluginsPath, slug)

    if (!existsSync(pluginPath)) {
      return false
    }

    const plugin = await Plugin.query().where('slug', slug).first()

    // Load plugin so its uninstall hooks can run
    if (plugin && plugin.isActive) {
      await this.loadPlugin(slug)
    }

    // Fire uninstall hooks
    await this.fireLifecycle('plugin.uninstalling', slug, null)
    await this.hookManager.doAction('plugin_uninstalling', slug)
    await this.hookManager.doAction(`plugin_uninstalling_${slug}`)

    // Deactivate first if active
    await this.deactivatePlugin(slug)

    // Delete database record
    if (plugin) {
      await plugin.delete()
    }

    // Delete the plugin directory
    rmSync(pluginPath, { recursive: true, force: true })

    return true
  }

  /**
   * Upload and extract a plugin from a ZIP file.
   * Returns the slug and path of the extracted plugin.
   */
  async uploadPlugin(file: {
    tmpPath?: string
    clientName: string
    move: (dest: string, options?: any) => Promise<void>
  }): Promise<{ slug: string; path: string }> {
    // For AdonisJS multipart files, we need to handle extraction.
    // We use the Node.js built-in zlib and tar, or the host app can provide
    // a ZIP extraction utility. For now, we do a simple directory-based approach.

    // Move the uploaded file to a temp location
    const tempDir = join(this.pluginsPath, '.tmp')
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }

    await file.move(tempDir, { name: file.clientName, overwrite: true })

    const uploadedPath = join(tempDir, file.clientName)

    // Extract ZIP using dynamic import of adm-zip (or similar)
    let extractPath: string | null = null
    let createdExtractPath = false

    try {
      // Attempt dynamic import of adm-zip
      const { default: AdmZip } = await import('adm-zip')
      const zip = new AdmZip(uploadedPath)
      const entries = zip.getEntries()

      const rootFolder = collectSafeArchiveRootFolder(
        entries.map((entry) => entry.entryName),
        this.pluginsPath
      )
      extractPath = resolveWithinBasePath(this.pluginsPath, rootFolder)
      if (existsSync(extractPath)) {
        throw new Error(`Plugin "${rootFolder}" already exists`)
      }

      // Extract to plugins directory
      zip.extractAllTo(this.pluginsPath, true)
      createdExtractPath = true

      // Validate plugin.json exists
      const manifestPath = join(extractPath, 'plugin.json')
      if (!existsSync(manifestPath)) {
        rmSync(extractPath, { recursive: true, force: true })
        throw new Error('Invalid plugin: missing plugin.json')
      }

      return { slug: rootFolder, path: extractPath }
    } catch (error) {
      if (createdExtractPath && extractPath && existsSync(extractPath)) {
        rmSync(extractPath, { recursive: true, force: true })
      }

      throw error
    } finally {
      // Clean up temp file
      try {
        if (existsSync(uploadedPath)) {
          rmSync(uploadedPath)
        }
        if (existsSync(tempDir)) {
          rmSync(tempDir, { recursive: true, force: true })
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Load all active plugins. Called once during application boot.
   */
  async loadActivePlugins(): Promise<void> {
    const activatedSlugs = await this.getActivatedPlugins()

    for (const slug of activatedSlugs) {
      await this.loadPlugin(slug)
    }
  }

  /**
   * Resolve the filesystem path for a plugin slug, checking local and npm sources.
   */
  private async resolvePluginPath(slug: string): Promise<string | null> {
    // Check local plugins first
    const localPath = join(this.pluginsPath, slug)
    if (existsSync(join(localPath, 'plugin.json'))) {
      return localPath
    }

    // Check npm plugins
    const nodeModulesPath = join(process.cwd(), 'node_modules')
    // Direct package
    const directPath = join(nodeModulesPath, slug)
    if (existsSync(join(directPath, 'plugin.json'))) {
      return directPath
    }
    // Scoped package (slug uses -- separator)
    if (slug.includes('--')) {
      const scopedPath = join(nodeModulesPath, slug.replace('--', '/'))
      if (existsSync(join(scopedPath, 'plugin.json'))) {
        return scopedPath
      }
    }

    return null
  }

  /**
   * Load a specific plugin by dynamically importing its main file.
   * The plugin's main file should export a default function or class
   * that receives the HookManager as its first argument.
   */
  async loadPlugin(slug: string): Promise<void> {
    const pluginPath = await this.resolvePluginPath(slug)

    if (!pluginPath) {
      return
    }

    const manifestPath = join(pluginPath, 'plugin.json')

    let manifest: PluginManifest
    try {
      const raw = readFileSync(manifestPath, 'utf-8')
      manifest = JSON.parse(raw)
    } catch {
      return
    }

    const mainFile = manifest.main_file ?? 'Plugin.ts'
    const pluginFile = join(pluginPath, mainFile)

    if (!existsSync(pluginFile)) {
      // Try .js extension as fallback
      const jsFile = pluginFile.replace(/\.ts$/, '.js')
      if (existsSync(jsFile)) {
        await this.executePluginFile(jsFile, slug, manifest)
      }
      return
    }

    await this.executePluginFile(pluginFile, slug, manifest)
  }

  /**
   * Execute a plugin's main file by dynamically importing it.
   */
  protected async executePluginFile(
    filePath: string,
    slug: string,
    manifest: PluginManifest
  ): Promise<void> {
    try {
      // Convert to file:// URL for dynamic import on Windows and Unix
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`
      const pluginModule = await import(fileUrl)

      // If the plugin exports a default function, call it with the hook manager
      if (typeof pluginModule.default === 'function') {
        // Check if it's a class (has prototype methods) or a plain function
        if (pluginModule.default.prototype && pluginModule.default.prototype.constructor) {
          // Class: instantiate with hookManager and call boot() if it exists
          const instance = new pluginModule.default(this.hookManager)
          if (typeof instance.boot === 'function') {
            await instance.boot()
          }
        } else {
          // Plain function: call with hookManager
          await pluginModule.default(this.hookManager)
        }
      }

      // If the plugin exports a register function, call it
      if (typeof pluginModule.register === 'function') {
        await pluginModule.register(this.hookManager)
      }

      // Fire the plugin_loaded action
      await this.hookManager.doAction('plugin_loaded', slug, manifest)
    } catch (error) {
      // Log but don't crash on plugin load failure
      console.error(`[Escalated] Failed to load plugin "${slug}":`, error)
    }
  }
}
