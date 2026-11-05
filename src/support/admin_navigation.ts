/*
|--------------------------------------------------------------------------
| Admin navigation
|--------------------------------------------------------------------------
|
| Escalated's admin menu as data, so a host can list it in its own sidebar
| (ADR 2026-11-05-embeddable-admin). Shared as `escalated.navigation` while
| the admin is embedded, and available as adminNavigation() for
| server-rendered (Edge) layouts whether or not it is.
|
| Filtered server-side so a host sidebar never links to a screen that would
| answer 403 or 404: the admin gate (unless the host replaced it), routes that
| are not registered, feature switches and, while roles & permissions is on,
| each route's permission. Plugin admin menu items are merged in.
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import { getConfig } from '../helpers/config.js'
import { rolesPermissionsEnabled } from './access_features.js'
import { userPermissions } from './permissions.js'
import { requiredPermissions } from './route_permissions.js'
import { resolveEmbed } from './embed.js'
import { pluginExtensions } from './shared_data.js'

export interface AdminNavigationChild {
  label: string
  url: string
  icon: string | null
}

export interface AdminNavigationItem {
  key: string
  label: string
  route: string | null
  url: string
  icon: string | null
  position: number
  active: boolean
  badge: unknown
  plugin: string | null
  children: AdminNavigationChild[]
}

/**
 * Core items: key (also the icon key), label, route name, position. Labels
 * and positions match the standalone admin sidebar in the shared frontend.
 * The audit log is `escalated.admin.audit-logs.index` in this port.
 */
export const ADMIN_NAVIGATION_ITEMS: ReadonlyArray<readonly [string, string, string, number]> = [
  ['reports', 'Reports', 'escalated.admin.reports', 10],
  ['tickets', 'Tickets', 'escalated.admin.tickets.index', 20],
  ['departments', 'Departments', 'escalated.admin.departments.index', 30],
  ['sla-policies', 'SLA Policies', 'escalated.admin.sla-policies.index', 40],
  ['knowledge-base', 'Knowledge Base', 'escalated.admin.kb-articles.index', 45],
  ['escalation-rules', 'Escalation Rules', 'escalated.admin.escalation-rules.index', 50],
  ['workflows', 'Workflows', 'escalated.admin.workflows.index', 53],
  ['automations', 'Automations', 'escalated.admin.automations.index', 53.5],
  ['webhooks', 'Webhooks', 'escalated.admin.webhooks.index', 54],
  ['tags', 'Tags', 'escalated.admin.tags.index', 60],
  ['custom-fields', 'Custom Fields', 'escalated.admin.custom-fields.index', 62],
  ['statuses', 'Statuses', 'escalated.admin.statuses.index', 64],
  ['canned-responses', 'Canned Responses', 'escalated.admin.canned-responses.index', 70],
  ['macros', 'Macros', 'escalated.admin.macros.index', 80],
  ['newsletters', 'Newsletters', 'escalated.admin.newsletters.index', 81],
  ['skills', 'Skills', 'escalated.admin.skills.index', 82],
  ['users', 'Users', 'escalated.admin.users.index', 83],
  ['roles', 'Roles', 'escalated.admin.roles.index', 84],
  ['capacity', 'Capacity', 'escalated.admin.capacity.index', 85],
  ['business-hours', 'Business Hours', 'escalated.admin.business-hours.index', 86],
  ['audit-log', 'Audit Log', 'escalated.admin.audit-logs.index', 88],
  ['api-tokens', 'API Tokens', 'escalated.admin.api-tokens.index', 90],
  ['custom-objects', 'Custom Objects', 'escalated.admin.custom-objects.index', 92],
  ['plugins', 'Plugins', 'escalated.admin.plugins.index', 95],
  ['import', 'Import', 'escalated.admin.import.index', 97],
  ['settings', 'Settings', 'escalated.admin.settings', 100],
]

/** The path of the request in `ctx`, without the query string. */
function requestPath(ctx: any): string {
  try {
    return String(ctx?.request?.url?.() ?? '').split('?')[0]
  } catch {
    return ''
  }
}

function isActive(path: string, url: string): boolean {
  const target = url.split('?')[0].replace(/\/+$/, '') || '/'
  return path === target || path.startsWith(`${target}/`)
}

async function routeUrl(name: string): Promise<string | null> {
  const { default: router } = await import('@adonisjs/core/services/router')
  const route = router?.find?.(name)
  if (!route) return null
  const pattern = String(route.pattern)
  return pattern.startsWith('/') ? pattern : `/${pattern}`
}

/**
 * Escalated's admin menu for `user` (default: the signed-in user of `ctx`):
 * key, label, route, url, icon, position, active, badge, plugin, children,
 * sorted by position. Empty for anyone who fails Escalated's admin gate,
 * unless the host replaced the gate (`ui.embed.replaceAdminGate`).
 */
export async function adminNavigation(
  user?: unknown,
  ctx?: HttpContext | null
): Promise<AdminNavigationItem[]> {
  const viewer = user ?? (ctx as any)?.auth?.user
  if (!viewer) return []

  const config = getConfig()
  const embed = resolveEmbed()
  const isAdmin = Boolean(
    config.authorization?.isAdmin && (await config.authorization.isAdmin(viewer))
  )
  if (!isAdmin && !embed?.replaceAdminGate) return []

  const path = requestPath(ctx)
  const rolesOn = rolesPermissionsEnabled()
  const granted = rolesOn ? await userPermissions((viewer as { id?: any }).id) : null

  const items: AdminNavigationItem[] = []
  for (const [key, label, route, position] of ADMIN_NAVIGATION_ITEMS) {
    if (key === 'roles' && !rolesOn) continue
    if (key === 'plugins' && (config as any).plugins?.enabled === false) continue
    const url = await routeUrl(route)
    if (url === null) continue
    if (granted !== null) {
      const required = requiredPermissions(route, () => undefined)
      if (required === null || required.some((slug) => !granted.includes(slug))) continue
    }
    items.push(item(key, label, route, url, key, position, path))
  }

  const pluginItems = await pluginAdminItems(viewer, granted)
  for (const [index, plugin] of pluginItems.entries()) {
    const url = plugin.route
    if (typeof url !== 'string' || url === '') continue
    const entry = item(
      `plugin:${plugin.plugin ?? 'native'}:${index}`,
      String(plugin.label ?? ''),
      null,
      url,
      typeof plugin.icon === 'string' ? plugin.icon : null,
      Number(plugin.position ?? 100),
      path
    )
    entry.badge = plugin.badge ?? null
    entry.plugin = plugin.plugin ?? null
    entry.children = (Array.isArray(plugin.submenu) ? plugin.submenu : []).map((child: any) => ({
      label: String(child?.label ?? ''),
      url: String(child?.url ?? child?.route ?? ''),
      icon: typeof child?.icon === 'string' ? child.icon : null,
    }))
    items.push(entry)
  }

  // Stable: equal positions keep their order, as the standalone sidebar does.
  return items
    .map((entry, order) => ({ entry, order }))
    .sort((a, b) => a.entry.position - b.entry.position || a.order - b.order)
    .map(({ entry }) => entry)
}

function item(
  key: string,
  label: string,
  route: string | null,
  url: string,
  icon: string | null,
  position: number,
  path: string
): AdminNavigationItem {
  return {
    key,
    label,
    route,
    url,
    icon,
    position,
    active: path !== '' && isActive(path, url),
    badge: null,
    plugin: null,
    children: [],
  }
}

/**
 * Plugin menu items for the admin section, as `escalated.plugins.menuItems`
 * gives them to an admin (the plugin contract's filtering). The admin gate was
 * checked by the caller, or replaced by the host.
 */
async function pluginAdminItems(viewer: unknown, granted: string[] | null): Promise<any[]> {
  if ((getConfig() as any).plugins?.enabled === false) return []
  try {
    const extensions = await pluginExtensions({
      isAdmin: true,
      permissions: granted ?? [],
      prefix: getConfig().routes?.prefix ?? 'support',
      viewer,
    })
    const menuItems = (extensions as any).menuItems ?? []
    return menuItems.filter((entry: any) => (entry.section ?? 'admin') === 'admin')
  } catch {
    return []
  }
}
