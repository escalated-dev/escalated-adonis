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
import type { PluginManifest, PluginInfo } from '../types.js'

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
    return [...local, ...npm]
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
            source: 'composer',  // Use 'composer' for frontend consistency
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
   * Activate a plugin: create/update DB record, load the plugin, fire hooks.
   */
  async activatePlugin(slug: string): Promise<boolean> {
    // Verify plugin directory and manifest exist (check both local and npm sources)
    const pluginPath = await this.resolvePluginPath(slug)
    if (!pluginPath || !existsSync(join(pluginPath, 'plugin.json'))) {
      throw new Error(`Plugin "${slug}" not found or missing plugin.json`)
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
      plugin.activatedAt = (await import('luxon')).DateTime.now()
      plugin.deactivatedAt = null
      await plugin.save()

      // Load the plugin so its hooks are registered
      await this.loadPlugin(slug)

      // Fire activation hooks
      await this.hookManager.doAction('plugin_activated', slug)
      await this.hookManager.doAction(`plugin_activated_${slug}`)
    }

    return true
  }

  /**
   * Deactivate a plugin: fire hooks, then update the DB record.
   */
  async deactivatePlugin(slug: string): Promise<boolean> {
    const plugin = await Plugin.query().where('slug', slug).first()

    if (plugin && plugin.isActive) {
      // Fire deactivation hooks BEFORE deactivating
      await this.hookManager.doAction('plugin_deactivated', slug)
      await this.hookManager.doAction(`plugin_deactivated_${slug}`)

      plugin.isActive = false
      plugin.deactivatedAt = (await import('luxon')).DateTime.now()
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
      throw new Error('npm plugins cannot be deleted. Remove the package via npm instead.')
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
    let rootFolder: string

    try {
      // Attempt dynamic import of adm-zip
      const { default: AdmZip } = await import('adm-zip')
      const zip = new AdmZip(uploadedPath)
      const entries = zip.getEntries()

      // Determine root folder
      rootFolder = ''
      for (const entry of entries) {
        const name = entry.entryName
        if (name.includes('/')) {
          rootFolder = name.substring(0, name.indexOf('/'))
          break
        }
      }

      if (!rootFolder) {
        throw new Error('Invalid plugin structure: no root folder found in ZIP')
      }

      const extractPath = join(this.pluginsPath, rootFolder)
      if (existsSync(extractPath)) {
        throw new Error(`Plugin "${rootFolder}" already exists`)
      }

      // Extract to plugins directory
      zip.extractAllTo(this.pluginsPath, true)

      // Validate plugin.json exists
      const manifestPath = join(extractPath, 'plugin.json')
      if (!existsSync(manifestPath)) {
        rmSync(extractPath, { recursive: true, force: true })
        throw new Error('Invalid plugin: missing plugin.json')
      }

      return { slug: rootFolder, path: extractPath }
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
