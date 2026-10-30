/*
|--------------------------------------------------------------------------
| SDK plugin activation
|--------------------------------------------------------------------------
|
| Which SDK plugins are active (domain-model/plugin-contract.md, Storage and
| Lifecycle). SDK plugins share the escalated_plugins table with native ones,
| keyed by the contract's slug of their name; a plugin with no row is
| inactive. The bridge loads every installed SDK plugin and gates each call
| by this: hooks, endpoints, webhooks, pages, cron, badges and UI extensions
| only reach active plugins.
|
*/

import { DateTime } from 'luxon'
import Plugin from '../models/plugin.js'
import EscalatedSetting from '../models/escalated_setting.js'
import { pluginSlug } from '../support/plugin_events.js'

/** Set once SDK plugins have been recorded. Before it, every SDK plugin ran. */
export const RECORDED_SETTING = 'plugins_sdk_activation_recorded'

/**
 * The contract's URL-safe slug for an SDK plugin name:
 * `@escalated-dev/plugin-slack` is `escalated-dev--plugin-slack`.
 */
export function sdkPluginSlug(name: string): string {
  return pluginSlug(name)
}

/** The names among `names` whose plugins are active, in the given order. */
export async function activeSdkPluginNames(names: Iterable<string>): Promise<string[]> {
  const list = [...names]
  if (list.length === 0) return []
  try {
    const rows = await Plugin.query()
      .whereIn(
        'slug',
        list.map((name) => sdkPluginSlug(name))
      )
      .where('is_active', true)
      .select('slug')
    const active = new Set(rows.map((row) => row.slug))
    return list.filter((name) => active.has(sdkPluginSlug(name)))
  } catch {
    // The table may not exist yet: nothing is active.
    return []
  }
}

export async function isSdkPluginActive(name: string): Promise<boolean> {
  const active = await activeSdkPluginNames([name])
  return active.length > 0
}

/**
 * The first time SDK plugins are seen, record every one of them as active, so
 * an upgrade from a version that ran every SDK plugin does not silently switch
 * them off. Plugins installed later start inactive.
 */
export async function recordInstalledSdkPlugins(names: string[]): Promise<void> {
  if (names.length === 0) return
  try {
    if ((await EscalatedSetting.get(RECORDED_SETTING)) !== null) return
    for (const name of names) {
      const slug = sdkPluginSlug(name)
      const existing = await Plugin.query().where('slug', slug).first()
      if (!existing) {
        await Plugin.create({ slug, isActive: true, activatedAt: DateTime.now() })
      }
    }
    await EscalatedSetting.set(RECORDED_SETTING, DateTime.now().toISO() ?? 'yes')
  } catch (err) {
    // The tables may not exist yet (first migration run); try again next boot.
    console.debug(
      '[Escalated Bridge] Could not record installed SDK plugins:',
      (err as Error).message
    )
  }
}
