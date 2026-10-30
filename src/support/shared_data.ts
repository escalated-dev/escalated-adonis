/*
|--------------------------------------------------------------------------
| Shared Inertia data
|--------------------------------------------------------------------------
|
| The `escalated` prop every page receives. Kept out of the provider so it
| can be built for a request without Inertia.
|
*/

import type { EscalatedConfig } from '../types.js'
import { pluginSlug } from './plugin_events.js'
import { sharedAccessFeatures } from './access_features.js'
import { sharedPermissions } from './permissions.js'

type Allows = (ability: unknown) => boolean

/**
 * `escalated.plugins`: the shape the shared frontend's usePluginExtensions()
 * reads (domain-model/plugin-contract.md). Built from what native plugins
 * registered with the PluginUIService and from the SDK plugins' manifests.
 * Items whose permission or capability the viewer lacks are left out, and
 * admin menu items go to admins only. `{}` when there is nothing to show.
 * An SDK widget with a `badge` function carries its answer as `badge`, asked
 * as `viewer` (`null` when it fails).
 */
export async function pluginExtensions(options: {
  isAdmin: boolean
  permissions: string[]
  prefix: string
  viewer?: unknown
}): Promise<Record<string, unknown>> {
  const { isAdmin, permissions, prefix, viewer = null } = options
  const allows: Allows = (ability) =>
    ability === null ||
    ability === undefined ||
    ability === '' ||
    isAdmin ||
    permissions.includes(String(ability))

  const ui = (globalThis as any).__escalated_pluginUI
  const menuItems: Record<string, any>[] = []
  const dashboardWidgets: Record<string, any>[] = []
  const pageComponents: Record<string, Record<string, any>[]> = {}

  for (const item of (ui?.getMenuItems?.() ?? []) as any[]) {
    const section = item.section ?? item.target ?? 'admin'
    if ((section === 'admin' && !isAdmin) || !allows(item.permission)) continue
    menuItems.push({
      label: item.label,
      route: item.url || item.route || null,
      icon: item.icon ?? null,
      position: item.position ?? 100,
      section,
      plugin: item.plugin ?? null,
      badge: item.badge ?? null,
      submenu: item.submenu ?? [],
    })
  }

  for (const widget of (ui?.getDashboardWidgets?.() ?? []) as any[]) {
    if ((widget.target === 'admin' && !isAdmin) || !allows(widget.permission)) continue
    dashboardWidgets.push({
      id: widget.id,
      title: widget.title ?? null,
      component: widget.component ?? null,
      plugin: widget.plugin ?? null,
      data: widget.data ?? {},
      position: widget.position ?? 100,
      width: widget.width ?? 'full',
    })
  }

  for (const [page, slots] of (ui?.pageComponents ?? new Map()) as Map<
    string,
    Map<string, any[]>
  >) {
    for (const slot of slots.keys()) {
      for (const component of ui.getPageComponents(page, slot)) {
        if (!allows(component.permission)) continue
        ;(pageComponents[`${page}.${slot}`] ??= []).push({
          plugin: component.plugin ?? null,
          component: component.component ?? null,
          data: component.data ?? {},
          position: component.position ?? 100,
        })
      }
    }
  }

  const bridge = (globalThis as any).__escalated_pluginBridge
  const manifests: Map<string, any> = bridge?.isBooted?.()
    ? (bridge.getManifests?.() ?? new Map())
    : new Map()

  for (const [name, manifest] of manifests) {
    const slug = pluginSlug(name)

    for (const page of manifest?.pages ?? []) {
      const route = String(page?.route ?? '').replace(/^\/+/, '')
      if (!page?.menu || !route || !page.component) continue
      const section = page.menu.section ?? 'admin'
      if ((section === 'admin' && !isAdmin) || !allows(page.capability)) continue
      menuItems.push({
        label: page.menu.label ?? page.component,
        // Where RouteRegistrar mounts the page.
        route: `/${prefix}/admin/plugins/${slug}/${route}`,
        icon: page.menu.icon ?? null,
        position: page.menu.position ?? 100,
        section,
        plugin: slug,
      })
    }

    for (const widget of manifest?.widgets ?? []) {
      if (!widget?.component || !allows(widget.capability)) continue
      const item: Record<string, any> = {
        id: `${slug}.${widget.component}`,
        title: widget.label ?? null,
        component: widget.component,
        plugin: slug,
        position: widget.order ?? 100,
        width: widget.size ?? 'half',
      }
      if (widget.hasBadge === true) {
        item.badge =
          typeof bridge.widgetBadge === 'function'
            ? await bridge.widgetBadge(name, widget.component, viewer)
            : null
      }
      dashboardWidgets.push(item)
    }

    for (const item of manifest?.components ?? []) {
      if (!item?.page || !item.slot || !item.component || !allows(item.capability)) continue
      ;(pageComponents[`${item.page}.${item.slot}`] ??= []).push({
        plugin: slug,
        component: item.component,
        data: item.props ?? {},
        position: item.order ?? 100,
      })
    }
  }

  if (!menuItems.length && !dashboardWidgets.length && !Object.keys(pageComponents).length) {
    return {}
  }

  const byPosition = (a: any, b: any) => a.position - b.position
  for (const key of Object.keys(pageComponents)) pageComponents[key].sort(byPosition)

  return {
    menuItems: menuItems.sort(byPosition),
    pageComponents,
    dashboardWidgets: dashboardWidgets.sort(byPosition),
  }
}

/** The `escalated` shared prop for the request in `ctx`. */
export async function escalatedSharedData(ctx: any): Promise<Record<string, any>> {
  const config: EscalatedConfig = (globalThis as any).__escalated_config ?? {}
  const user = ctx?.auth?.user

  const data: Record<string, any> = {
    prefix: config.routes?.prefix ?? 'support',
    is_agent: false,
    is_admin: false,
    permissions: [],
  }

  if (user) {
    if (config.authorization?.isAgent) {
      data.is_agent = await config.authorization.isAgent(user)
    }
    if (config.authorization?.isAdmin) {
      data.is_admin = await config.authorization.isAdmin(user)
    }
    try {
      // ADR 2026-10-29-configurable-access-features: the user's slugs while
      // roles & permissions is on; `['*']` for staff while it is off.
      data.permissions = await sharedPermissions(
        (user as { id: any }).id,
        Boolean(data.is_agent || data.is_admin)
      )
    } catch {
      // permission tables may not exist yet
    }
  }

  // Share guest tickets setting
  try {
    const { default: EscalatedSetting } = await import('../models/escalated_setting.js')
    data.guest_tickets_enabled = await EscalatedSetting.guestTicketsEnabled()
    data.show_powered_by = await EscalatedSetting.getBool('show_powered_by', true)
  } catch {
    // Settings table may not exist yet
  }

  data.features = {
    newsletters: Boolean((config as any).enableNewsletters),
    ...sharedAccessFeatures(),
  }
  // A staff user who must enrol before using anything (ADR 2026-10-29).
  data.two_factor_required = false
  if (user && (data.is_agent || data.is_admin)) {
    try {
      const { confirmedEnrolment, twoFactorRequired } = await import('./two_factor.js')
      data.two_factor_required = (await twoFactorRequired()) && !(await confirmedEnrolment(user))
    } catch {
      // two-factor table may not exist yet
    }
  }

  try {
    data.plugins = await pluginExtensions({
      isAdmin: Boolean(data.is_admin),
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      prefix: data.prefix,
      viewer: user ?? null,
    })
  } catch {
    data.plugins = {}
  }

  return data
}
