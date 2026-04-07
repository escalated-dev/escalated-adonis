/*
|--------------------------------------------------------------------------
| Renderer Abstraction
|--------------------------------------------------------------------------
|
| Provides a thin abstraction over Inertia's render() method so that
| controllers are decoupled from the rendering implementation. When the
| UI is disabled (ui.enabled = false), the renderer returns a JSON
| response instead of an Inertia page, making the package usable in
| headless / API-only mode.
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import { getConfig } from '../helpers/config.js'

/**
 * Renderer contract.
 */
export interface RendererContract {
  render(ctx: HttpContext, component: string, props?: Record<string, any>): any
}

/**
 * InertiaRenderer — delegates to `ctx.inertia.render()`.
 * Used when `ui.enabled` is true.
 */
export class InertiaRenderer implements RendererContract {
  render(ctx: HttpContext, component: string, props: Record<string, any> = {}): any {
    return ctx.inertia.render(component, props)
  }
}

/**
 * JsonRenderer — returns props as a JSON response.
 * Used when `ui.enabled` is false (headless mode).
 */
export class JsonRenderer implements RendererContract {
  render(ctx: HttpContext, component: string, props: Record<string, any> = {}): any {
    return ctx.response.json({ component, props })
  }
}

/**
 * Resolve the appropriate renderer based on the current config.
 */
let cachedRenderer: RendererContract | null = null

export function getRenderer(): RendererContract {
  if (cachedRenderer) return cachedRenderer

  const config = getConfig()
  const uiEnabled = (config as any).ui?.enabled !== false

  cachedRenderer = uiEnabled ? new InertiaRenderer() : new JsonRenderer()
  return cachedRenderer
}

/**
 * Check whether the Inertia UI is enabled.
 */
export function isUiEnabled(): boolean {
  const config = getConfig()
  return (config as any).ui?.enabled !== false
}

/**
 * Reset the cached renderer (used when config changes, e.g. in tests).
 */
export function resetRenderer(): void {
  cachedRenderer = null
}
