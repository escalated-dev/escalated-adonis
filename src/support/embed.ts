/*
|--------------------------------------------------------------------------
| Embedding the admin in the host's own admin panel
|--------------------------------------------------------------------------
|
| Optional, and off by default (ADR 2026-11-05-embeddable-admin). While
| `ui.embed.enabled` is not true, nothing here has any effect: the admin stays
| at `/{routes.prefix}/admin` with its own middleware, and no prop or header
| changes.
|
| Turned on, the admin routes are registered under `ui.embed.prefix` with the
| host's middleware (same route names), embedded responses are marked so the
| shared frontend renders them chrome-free, the admin menu is shared as
| `escalated.navigation`, and in iframe mode embedded responses may be framed
| by the listed origins only.
|
*/

import type { HttpContext, Router } from '@adonisjs/core/http'
import { getConfig } from '../helpers/config.js'
import {
  escalatedMiddleware,
  resolveConfiguredMiddleware,
  type ConfiguredMiddleware,
} from './route_middleware.js'

export const EMBED_MODES = ['layout', 'iframe'] as const
export type EscalatedEmbedMode = (typeof EMBED_MODES)[number]

export const DEFAULT_EMBED_PREFIX = 'admin/support'

/**
 * `ui.embed` in config/escalated.ts. Every key is optional; a key left out
 * falls back to its environment variable, then to the default.
 */
export interface EscalatedEmbedConfig {
  /** Master switch. Default `false` (env `ESCALATED_EMBED=true`). */
  enabled?: boolean
  /** `'layout'` (Vue + Inertia or Edge host) or `'iframe'`. Default `'layout'` (env `ESCALATED_EMBED_MODE`). */
  mode?: EscalatedEmbedMode
  /** URL prefix the admin moves under. Default `'admin/support'` (env `ESCALATED_EMBED_PREFIX`). */
  prefix?: string
  /**
   * Middleware for the embedded admin routes, named as in `router.named()` in
   * start/kernel.ts (or references / functions). `null` keeps
   * `routes.adminMiddleware`.
   */
  middleware?: ConfiguredMiddleware[] | null
  /**
   * `true` removes Escalated's admin gate (`ensureIsAdmin`) from the embedded
   * routes, so `middleware` alone decides who reaches the admin. Two-factor
   * and route permissions still apply. Refused without `middleware`.
   */
  replaceAdminGate?: boolean
  /** Name of the host layout the frontend's `layouts` option wraps admin pages in. */
  layout?: string | null
  /**
   * Inertia root view (an Edge template, or a function of the request as in
   * config/inertia.ts) for embedded admin responses only. `null` keeps the
   * host's `rootView`.
   */
  rootView?: string | ((ctx: HttpContext) => string) | null
  /**
   * iframe mode: exact origins allowed to frame the admin
   * (`https://admin.example.com`), as a list or a comma-separated string.
   * Wildcards and `*` are dropped. Default `[]` (env `ESCALATED_EMBED_FRAME_ANCESTORS`).
   */
  frameAncestors?: string[] | string
}

/** The embed configuration in effect, with defaults applied. */
export interface ResolvedEmbed {
  mode: EscalatedEmbedMode
  /** Without leading or trailing slashes. */
  prefix: string
  middleware: ConfiguredMiddleware[] | null
  replaceAdminGate: boolean
  layout: string | null
  rootView: string | ((ctx: HttpContext) => string) | null
  frameAncestors: string[]
}

type Env = Record<string, string | undefined>

function envFlag(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase())
}

/**
 * An exact `scheme://host[:port]` origin, or null for anything else:
 * wildcards, `*`, paths, queries, credentials and non-http(s) schemes.
 */
export function embedOrigin(value: string): string | null {
  const text = value.trim()
  if (!text || text.includes('*')) return null
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null
  if (url.username || url.password || url.search || url.hash) return null
  if (url.pathname !== '/' && url.pathname !== '') return null
  // `https://example.com?` parses to an empty query: still not a plain origin.
  if (!/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+\/?$/i.test(text)) return null
  return url.origin
}

/** The allow-list: exact origins only, deduplicated. */
export function embedFrameAncestors(configured: string[] | string | null | undefined): string[] {
  const list = typeof configured === 'string' ? configured.split(',') : (configured ?? [])
  const origins: string[] = []
  for (const entry of list) {
    const origin = typeof entry === 'string' ? embedOrigin(entry) : null
    if (origin && !origins.includes(origin)) origins.push(origin)
  }
  return origins
}

function normalise(embed: EscalatedEmbedConfig, env: Env): ResolvedEmbed {
  const mode = (embed.mode ?? (env.ESCALATED_EMBED_MODE || 'layout')) as EscalatedEmbedMode
  if (!EMBED_MODES.includes(mode)) {
    throw new Error(`Escalated: ui.embed.mode must be 'layout' or 'iframe', got '${String(mode)}'.`)
  }
  const prefix = String(embed.prefix ?? (env.ESCALATED_EMBED_PREFIX || DEFAULT_EMBED_PREFIX))
    .trim()
    .replace(/^\/+|\/+$/g, '')
  const middleware = Array.isArray(embed.middleware) ? [...embed.middleware] : null
  const replaceAdminGate = embed.replaceAdminGate === true
  if (replaceAdminGate && !middleware?.length) {
    throw new Error(
      'Escalated: ui.embed.replaceAdminGate needs ui.embed.middleware: without it nothing would ' +
        'check who reaches the admin.'
    )
  }
  return {
    mode,
    prefix: prefix || DEFAULT_EMBED_PREFIX,
    middleware,
    replaceAdminGate,
    layout: typeof embed.layout === 'string' && embed.layout !== '' ? embed.layout : null,
    rootView:
      (typeof embed.rootView === 'string' && embed.rootView !== '') ||
      typeof embed.rootView === 'function'
        ? embed.rootView
        : null,
    frameAncestors: embedFrameAncestors(
      embed.frameAncestors ?? env.ESCALATED_EMBED_FRAME_ANCESTORS ?? []
    ),
  }
}

const resolved = new WeakMap<object, ResolvedEmbed | null>()

/**
 * The embed configuration in effect, or null while embedding is off (the
 * default): `ui.embed.enabled` (else `ESCALATED_EMBED`) is not true, or the
 * screens (`ui.enabled`) are off.
 */
export function resolveEmbed(
  config: { ui?: { enabled?: boolean; embed?: EscalatedEmbedConfig } } = getConfig(),
  env: Env = process.env
): ResolvedEmbed | null {
  if (!config || typeof config !== 'object') return null
  if (env === process.env && resolved.has(config)) return resolved.get(config) ?? null
  const embed = config.ui?.embed ?? {}
  const enabled = config.ui?.enabled !== false && (embed.enabled ?? envFlag(env.ESCALATED_EMBED))
  const result = enabled === true ? normalise(embed, env) : null
  if (env === process.env) resolved.set(config, result)
  return result
}

/**
 * Turns embedding on, with the same settings as `ui.embed`:
 *
 *     ui: {
 *       enabled: true,
 *       embed: embedAdmin({
 *         prefix: 'admin/support',
 *         middleware: ['auth', 'admin'],
 *         layout: 'Layouts/AdminLayout',
 *       }),
 *     },
 *
 * Throws on an unknown `mode`, and on `replaceAdminGate` without `middleware`.
 */
export function embedAdmin(
  options: Omit<EscalatedEmbedConfig, 'enabled'> = {}
): EscalatedEmbedConfig {
  const embed: EscalatedEmbedConfig = {
    mode: 'layout',
    prefix: DEFAULT_EMBED_PREFIX,
    middleware: null,
    replaceAdminGate: false,
    layout: null,
    rootView: null,
    frameAncestors: [],
    ...options,
    enabled: true,
  }
  normalise(embed, {})
  return embed
}

/**
 * Where the admin lives, as an absolute path without a trailing slash:
 * `/{routes.prefix}/admin`, or `/{ui.embed.prefix}` while embedded.
 */
export function adminBasePath(): string {
  const embed = resolveEmbed()
  if (embed) return `/${embed.prefix}`
  return `/${String(getConfig().routes?.prefix ?? 'support').replace(/^\/+|\/+$/g, '')}/admin`
}

/**
 * The prefix and middleware of an admin route group. Without embedding it is
 * exactly `{routes.prefix}/admin` and `routes.adminMiddleware + gate +
 * guards`, as before. Embedded: the host's prefix and middleware (or
 * `routes.adminMiddleware`), the admin gate unless the host replaced it, the
 * same guards, and the embed context last.
 */
export async function adminRouteMount(
  router: Router,
  guards: (middleware: ReturnType<typeof escalatedMiddleware>) => any[]
): Promise<{ prefix: string; middleware: any[] }> {
  const config = getConfig()
  const middleware = escalatedMiddleware(router)
  const embed = resolveEmbed()

  if (!embed) {
    return {
      prefix: `${config.routes?.prefix ?? 'support'}/admin`,
      middleware: [
        ...(await resolveConfiguredMiddleware(
          config.routes?.adminMiddleware ?? ['auth'],
          'routes.adminMiddleware'
        )),
        middleware.ensureIsAdmin(),
        ...guards(middleware),
      ],
    }
  }

  const host = embed.middleware
    ? await resolveConfiguredMiddleware(embed.middleware, 'ui.embed.middleware')
    : await resolveConfiguredMiddleware(
        config.routes?.adminMiddleware ?? ['auth'],
        'routes.adminMiddleware'
      )

  return {
    prefix: embed.prefix,
    middleware: [
      ...host,
      ...(embed.replaceAdminGate ? [] : [middleware.ensureIsAdmin()]),
      ...guards(middleware),
      middleware.applyEmbedContext(),
    ],
  }
}

/** Request marker set by the embed context middleware. */
const EMBEDDED = Symbol.for('escalated.embedded')

/** Marks the request in `ctx` as served by an embedded admin route. */
export function markEmbedded(ctx: HttpContext): void {
  ;(ctx as any)[EMBEDDED] = true
}

/** Whether `ctx` was served by an embedded admin route. */
export function isEmbeddedRequest(ctx: unknown): boolean {
  return Boolean(ctx && (ctx as any)[EMBEDDED] === true)
}

/** The `escalated.embed` shared prop. Only shared while embedding is on. */
export function embedProp(embed: ResolvedEmbed, ctx: any): Record<string, unknown> {
  const embedded = isEmbeddedRequest(ctx)
  return {
    enabled: embedded,
    mode: embed.mode,
    layout: embed.layout,
    route: embedded ? (ctx?.route?.name ?? null) : null,
    base_url: `/${embed.prefix}`,
    allowed_origins: embed.mode === 'iframe' ? embed.frameAncestors : [],
  }
}

/** The `Content-Security-Policy` an embedded iframe response carries. */
export function frameAncestorsDirective(embed: Pick<ResolvedEmbed, 'frameAncestors'>): string {
  return ["frame-ancestors 'self'", ...embed.frameAncestors].join(' ')
}

const FRAMED = Symbol.for('escalated.embedFrameHeaders')

/**
 * iframe mode: when the response's headers are written (after every
 * middleware, the host's included), allow the configured origins to frame it
 * and drop `X-Frame-Options`, which `frame-ancestors` replaces. A CSP the
 * host already sends is kept and this directive is added as a second policy.
 * Only the response of `ctx` is touched.
 */
export function applyFrameHeaders(ctx: HttpContext, embed: ResolvedEmbed): void {
  const raw: any = ctx.response?.response
  if (!raw || typeof raw.writeHead !== 'function' || raw[FRAMED]) return
  raw[FRAMED] = true

  const directive = frameAncestorsDirective(embed)
  const writeHead = raw.writeHead
  raw.writeHead = function (this: any, ...args: any[]) {
    const policies: string[] = []
    for (const arg of args) {
      if (!arg || typeof arg !== 'object' || Array.isArray(arg)) continue
      for (const key of Object.keys(arg)) {
        const name = key.toLowerCase()
        if (name === 'x-frame-options') delete arg[key]
        if (name === 'content-security-policy') {
          policies.push(...([] as unknown[]).concat(arg[key]).map(String))
          delete arg[key]
        }
      }
    }
    if (!raw.headersSent) {
      raw.removeHeader('X-Frame-Options')
      const existing = raw.getHeader('Content-Security-Policy')
      if (existing !== undefined)
        policies.unshift(...([] as unknown[]).concat(existing).map(String))
      raw.setHeader('Content-Security-Policy', [...policies, directive])
    }
    return writeHead.apply(this, args)
  }
}
