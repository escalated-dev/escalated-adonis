/*
|--------------------------------------------------------------------------
| Optional public routes
|--------------------------------------------------------------------------
|
| The guest portal and the widget answer without a signed-in user. An install
| that never uses them can leave them unregistered:
|
|   guest.routesEnabled   (env ESCALATED_GUEST_ROUTES)   {prefix}/guest/*
|   widget.enabled        (env ESCALATED_WIDGET_ENABLED) {prefix}/widget/*
|
| Both default to on, so an install that sets neither keeps every route it
| had. They are read once, when routes are registered. The admin settings
| (`guest_tickets_enabled`, `widget_enabled`) still switch a mounted feature
| on and off at runtime as before.
|
*/

// No relative imports: the unit tests load this file directly with Node's
// type stripping. The config is the one the provider stores globally
// (src/helpers/config.ts reads the same object).
function getConfig(): Record<string, unknown> {
  return (globalThis as any).__escalated_config ?? {}
}

const OFF = ['false', '0', 'no', 'off']
const ON = ['true', '1', 'yes', 'on']

/** A boolean-ish value: true/false, or one of the strings above. Undefined when it is neither. */
function flag(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (OFF.includes(normalized)) return false
    if (ON.includes(normalized)) return true
  }
  return undefined
}

/** The configured value, else the environment variable, else on. */
function switchOn(configured: unknown, envName: string): boolean {
  return flag(configured) ?? flag(process.env[envName]) ?? true
}

/** Whether the guest portal routes (`{prefix}/guest/*`) are registered. */
export function guestRoutesEnabled(): boolean {
  const guest = (getConfig() as { guest?: { routesEnabled?: unknown } }).guest
  return switchOn(guest?.routesEnabled, 'ESCALATED_GUEST_ROUTES')
}

/** Whether the widget routes (`{prefix}/widget/*`, including chat and embed.js) are registered. */
export function widgetRoutesEnabled(): boolean {
  const widget = (getConfig() as { widget?: { enabled?: unknown } }).widget
  return switchOn(widget?.enabled, 'ESCALATED_WIDGET_ENABLED')
}
