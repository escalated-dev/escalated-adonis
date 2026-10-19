/*
|--------------------------------------------------------------------------
| Widget origins
|--------------------------------------------------------------------------
|
| Decides which other sites may embed the widget. The list is the host's
| `widget.allowedOrigins` config (an array, or the comma separated
| ESCALATED_WIDGET_ALLOWED_ORIGINS string) plus the `widget_allowed_origins`
| admin setting (one origin per line, or comma separated).
|
| Entries are bare origins, `scheme://host[:port]`, http or https only.
| `https://*.example.com` matches any subdomain of example.com, at any depth,
| but not example.com itself. A bare `*` is never accepted.
|
| No relative imports: the unit tests load this file directly with Node's
| type stripping, which does not map `.js` specifiers to `.ts` sources.
|
*/

/** Context property holding the allowed cross-origin Origin of a widget request. */
export const WIDGET_ORIGIN = 'escalatedWidgetOrigin'

/** Context property set when `isWidgetCsrfExempt` let a request skip the CSRF check. */
export const WIDGET_CSRF_SKIPPED = 'escalatedWidgetCsrfSkipped'

/** How long the synchronous check trusts the last admin setting it read. */
const SETTING_TTL_MS = 30_000

interface RequestLike {
  header(name: string): string | null | undefined
  protocol(): string
  host(): string | null
}

const ORIGIN = /^(https?):\/\/([^/?#@\s\\]+)\/?$/i
const PATTERN = /^(https?):\/\/(\*\.)?([^/?#@*\s\\]+)\/?$/i

/** `scheme://host[:port]`, lowercased, default ports dropped; null when not a bare http(s) origin. */
export function normalizeOrigin(value: string): string | null {
  const match = ORIGIN.exec(String(value).trim())
  if (!match) return null

  let url: URL
  try {
    url = new URL(`${match[1].toLowerCase()}://${match[2]}`)
  } catch {
    return null
  }
  if (!url.hostname || url.username || url.password) return null

  return `${url.protocol}//${url.host}`.toLowerCase()
}

/** Normalises an entered origin or `*.` pattern; null when it is not a bare http(s) origin. */
export function normalizeOriginPattern(entry: string): string | null {
  const match = PATTERN.exec(String(entry).trim())
  if (!match) return null

  const origin = normalizeOrigin(`${match[1]}://${match[3]}`)
  if (origin === null) return null

  return match[2] ? origin.replace('://', '://*.') : origin
}

function splitEntries(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  return values
    .filter((entry) => typeof entry === 'string')
    .flatMap((entry: string) => entry.split(/[\s,]+/))
    .filter((entry) => entry !== '')
}

/** The valid, de-duplicated patterns in a list or a newline/comma separated string. */
export function parseOriginPatterns(value: unknown): string[] {
  const patterns = new Set<string>()
  for (const entry of splitEntries(value)) {
    const pattern = normalizeOriginPattern(entry)
    if (pattern !== null) patterns.add(pattern)
  }
  return [...patterns]
}

/** The entries of an admin-entered list that are not bare origins. */
export function invalidOriginEntries(value: unknown): string[] {
  return splitEntries(value).filter((entry) => normalizeOriginPattern(entry) === null)
}

function originMatches(pattern: string, origin: string): boolean {
  if (!pattern.includes('://*.')) return pattern === origin

  const [scheme, suffix] = pattern.split('://*.', 2)
  if (!origin.startsWith(`${scheme}://`)) return false
  const host = origin.slice(scheme.length + 3)

  return host.endsWith(`.${suffix}`) && host.length > suffix.length + 1
}

function matchesAny(patterns: string[], origin: string): boolean {
  const normalized = normalizeOrigin(origin)
  return normalized !== null && patterns.some((pattern) => originMatches(pattern, normalized))
}

/** Patterns from the host config alone (no settings read). */
export function configuredOriginPatterns(): string[] {
  const config = (globalThis as any).__escalated_config ?? {}
  return parseOriginPatterns(config.widget?.allowedOrigins ?? [])
}

// ---- The admin setting ----

type SettingLoader = () => Promise<string | null>

const defaultSettingLoader: SettingLoader = async () => {
  const { default: EscalatedSetting } = await import('../models/escalated_setting.js')
  return EscalatedSetting.get('widget_allowed_origins', '')
}

let settingLoader: SettingLoader = defaultSettingLoader
let settingCache: { patterns: string[]; loadedAt: number } | null = null
let refreshing: Promise<unknown> | null = null

/** Replaces how the admin setting is read (tests); null restores the default. */
export function setWidgetOriginSettingLoader(loader: SettingLoader | null) {
  settingLoader = loader ?? defaultSettingLoader
}

/** Forgets the last admin setting read. */
export function resetWidgetOriginCache() {
  settingCache = null
  refreshing = null
}

/** Records a freshly saved or read admin setting value. */
export function rememberWidgetOriginSetting(value: string | null | undefined) {
  settingCache = { patterns: parseOriginPatterns(value ?? ''), loadedAt: Date.now() }
}

/** Every allowed pattern: the config list plus the admin setting, read now. */
export async function widgetOriginPatterns(): Promise<string[]> {
  rememberWidgetOriginSetting(await settingLoader())
  return [...new Set([...configuredOriginPatterns(), ...settingCache!.patterns])]
}

/** Whether an origin may embed the widget, reading the admin setting. */
export async function widgetOriginAllowed(origin: string): Promise<boolean> {
  return matchesAny(await widgetOriginPatterns(), origin)
}

/**
 * Whether an origin may embed the widget, without waiting on the database: the
 * config list plus the admin setting as last read in this process. A stale copy
 * is refreshed in the background. Every widget request reads the setting
 * afresh, and a browser's preflight comes before its POST, so the copy is
 * normally current; WidgetCors re-checks what this let through.
 */
export function widgetOriginAllowedNow(origin: string): boolean {
  if (matchesAny(configuredOriginPatterns(), origin)) return true

  if (
    !refreshing &&
    (settingCache === null || Date.now() - settingCache.loadedAt > SETTING_TTL_MS)
  ) {
    refreshing = widgetOriginPatterns()
      .catch(() => {})
      .finally(() => {
        refreshing = null
      })
  }

  return settingCache !== null && matchesAny(settingCache.patterns, origin)
}

// ---- Requests ----

/**
 * The request's Origin when it names another site, or null for same-origin
 * requests, requests without an Origin and the opaque `null` origin.
 */
export function crossOriginOf(request: RequestLike): string | null {
  const header = request.header('origin')
  if (typeof header !== 'string' || header === '' || header === 'null') return null

  const origin = normalizeOrigin(header)
  if (origin === null) return null

  const host = request.host()
  const own = host ? normalizeOrigin(`${request.protocol()}://${host}`) : null

  return origin === own ? null : origin
}

/**
 * For `@adonisjs/shield`'s `csrf.exceptRoutes`: true only for an Escalated
 * widget route called from an allowed other site. Such a request runs as a
 * guest with no session, so it has no CSRF token to send and none to protect.
 * Every other request keeps the CSRF check.
 *
 *   csrf: { enabled: true, exceptRoutes: (ctx) => isWidgetCsrfExempt(ctx) }
 */
export function isWidgetCsrfExempt(ctx: { route?: { name?: string }; request: RequestLike }) {
  const name = ctx.route?.name
  if (typeof name !== 'string' || !name.startsWith('escalated.widget.')) return false
  if (name === 'escalated.widget.script') return false

  const origin = crossOriginOf(ctx.request)
  if (origin === null || !widgetOriginAllowedNow(origin)) return false

  ;(ctx as any)[WIDGET_CSRF_SKIPPED] = true
  return true
}
