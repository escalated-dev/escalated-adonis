/*
|--------------------------------------------------------------------------
| Escalated Plugin Helpers
|--------------------------------------------------------------------------
|
| Global helper functions for the plugin system. All functions are prefixed
| with `escalated_` to avoid conflicts with the host application.
|
| These functions access the HookManager and PluginUIService singletons
| from globalThis, which are set during provider boot.
|
*/

import type HookManager from './hook_manager.js'
import type PluginUIService from '../services/plugin_ui_service.js'

/**
 * Get the HookManager singleton.
 */
function getHookManager(): HookManager {
  const hooks = (globalThis as any).__escalated_hooks
  if (!hooks) {
    throw new Error('[Escalated] HookManager not initialized. Ensure EscalatedProvider has booted.')
  }
  return hooks
}

/**
 * Get the PluginUIService singleton.
 */
function getPluginUI(): PluginUIService {
  const pluginUI = (globalThis as any).__escalated_pluginUI
  if (!pluginUI) {
    throw new Error('[Escalated] PluginUIService not initialized. Ensure EscalatedProvider has booted.')
  }
  return pluginUI
}

// ========================================
// ACTION HELPERS
// ========================================

/**
 * Add an action hook.
 *
 * @param tag - The action name
 * @param callback - The function to call
 * @param priority - Priority (lower numbers run first, default 10)
 */
export function escalated_addAction(
  tag: string,
  callback: (...args: any[]) => void | Promise<void>,
  priority: number = 10
): void {
  getHookManager().addAction(tag, callback, priority)
}

/**
 * Execute all callbacks registered for an action.
 *
 * @param tag - The action name
 * @param args - Arguments to pass to callbacks
 */
export async function escalated_doAction(tag: string, ...args: any[]): Promise<void> {
  await getHookManager().doAction(tag, ...args)
}

/**
 * Check if an action has callbacks registered.
 */
export function escalated_hasAction(tag: string): boolean {
  return getHookManager().hasAction(tag)
}

/**
 * Remove an action hook. Pass a specific callback to remove only that one,
 * or omit to remove all callbacks for the tag.
 */
export function escalated_removeAction(
  tag: string,
  callback?: (...args: any[]) => void | Promise<void>
): void {
  getHookManager().removeAction(tag, callback)
}

// ========================================
// FILTER HELPERS
// ========================================

/**
 * Add a filter hook.
 *
 * @param tag - The filter name
 * @param callback - The function to call (receives value as first arg, returns transformed value)
 * @param priority - Priority (lower numbers run first, default 10)
 */
export function escalated_addFilter(
  tag: string,
  callback: (value: any, ...args: any[]) => any | Promise<any>,
  priority: number = 10
): void {
  getHookManager().addFilter(tag, callback, priority)
}

/**
 * Apply all callbacks registered for a filter.
 *
 * @param tag - The filter name
 * @param value - The initial value to filter
 * @param args - Additional arguments to pass to callbacks
 * @returns The final filtered value
 */
export async function escalated_applyFilters<T = any>(
  tag: string,
  value: T,
  ...args: any[]
): Promise<T> {
  return getHookManager().applyFilters(tag, value, ...args)
}

/**
 * Check if a filter has callbacks registered.
 */
export function escalated_hasFilter(tag: string): boolean {
  return getHookManager().hasFilter(tag)
}

/**
 * Remove a filter hook. Pass a specific callback to remove only that one,
 * or omit to remove all callbacks for the tag.
 */
export function escalated_removeFilter(
  tag: string,
  callback?: (value: any, ...args: any[]) => any | Promise<any>
): void {
  getHookManager().removeFilter(tag, callback)
}

// ========================================
// PLUGIN UI HELPERS
// ========================================

/**
 * Register a custom menu item.
 */
export function escalated_registerMenuItem(item: {
  label: string
  route?: string | null
  url?: string | null
  icon?: string | null
  permission?: string | null
  position?: number
  parent?: string | null
  badge?: string | number | null
  activeRoutes?: string[]
  submenu?: any[]
}): void {
  getPluginUI().addMenuItem(item)
}

/**
 * Register a dashboard widget.
 */
export function escalated_registerDashboardWidget(widget: {
  id?: string
  title: string
  component: string | null
  data?: Record<string, any>
  position?: number
  width?: 'full' | 'half' | 'third' | 'quarter'
  permission?: string | null
}): void {
  getPluginUI().addDashboardWidget(widget)
}

/**
 * Add a component to an existing page slot.
 *
 * @param page - Page identifier (e.g. 'ticket.show', 'dashboard')
 * @param slot - Slot name (e.g. 'sidebar', 'header', 'footer')
 * @param component - Component configuration
 */
export function escalated_addPageComponent(
  page: string,
  slot: string,
  component: {
    component: string | null
    data?: Record<string, any>
    position?: number
    permission?: string | null
    plugin?: string
  }
): void {
  getPluginUI().addPageComponent(page, slot, component)
}

/**
 * Get components for a specific page and slot.
 */
export function escalated_getPageComponents(
  page: string,
  slot: string
): Array<{
  component: string | null
  data: Record<string, any>
  position: number
  permission?: string | null
  plugin?: string
}> {
  return getPluginUI().getPageComponents(page, slot)
}
