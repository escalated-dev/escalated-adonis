import type { Router } from '@adonisjs/core/http'
import type { MiddlewareFn, ParsedNamedMiddleware } from '@adonisjs/core/types/http'
import { RuntimeException } from '@adonisjs/core/exceptions'

/*
|--------------------------------------------------------------------------
| Route middleware
|--------------------------------------------------------------------------
|
| AdonisJS runs each entry in a route's middleware list either as a function,
| called `(ctx, next)`, or through the `handle` of a named reference built by
| `router.named()`. Nothing else works: a lazy `() => import(...)` is called as
| if it were the middleware, resolves to a module and never calls `next()`, and
| a bare string such as `'auth'` has no `handle` at all.
|
*/

/**
 * A middleware entry in `routes.middleware` / `routes.adminMiddleware`.
 *
 * A string is the name the host gives the middleware in `router.named()` in its
 * `start/kernel.ts` -- `'auth'` for the starter kits' auth middleware. The
 * config file cannot hold `middleware.auth()` itself: config loads before the
 * router exists.
 */
export type ConfiguredMiddleware = string | MiddlewareFn | ParsedNamedMiddleware

/** Escalated's own middleware, as references a route can run. */
export function escalatedMiddleware(router: Router) {
  return router.named({
    ensureIsAgent: () => import('../middleware/ensure_is_agent.js'),
    ensureIsAdmin: () => import('../middleware/ensure_is_admin.js'),
    ensureNewslettersEnabled: () => import('../middleware/ensure_newsletters_enabled.js'),
    resolveTicket: () => import('../middleware/resolve_ticket.js'),
    authenticateApiToken: () => import('../middleware/authenticate_api_token.js'),
    apiRateLimit: () => import('../middleware/api_rate_limit.js'),
  })
}

type HostKernel = { middleware?: Record<string, unknown> }

async function importHostKernel(): Promise<HostKernel> {
  const { default: app } = await import('@adonisjs/core/services/app')
  // Through the application's importer, so `#start/kernel` resolves against the
  // host's import map rather than this package's.
  return app.import('#start/kernel')
}

/**
 * Turns configured middleware into entries a route can run, looking names up
 * in the host's `start/kernel.ts`.
 *
 * A name the kernel does not define fails here, when routes are registered,
 * rather than leaving the routes it was meant to guard unguarded.
 */
export async function resolveConfiguredMiddleware(
  entries: readonly ConfiguredMiddleware[],
  setting: string,
  importKernel: () => Promise<HostKernel> = importHostKernel
): Promise<Array<MiddlewareFn | ParsedNamedMiddleware>> {
  const names = entries.filter((entry): entry is string => typeof entry === 'string')
  if (names.length === 0) {
    return entries as Array<MiddlewareFn | ParsedNamedMiddleware>
  }

  let kernel: HostKernel
  try {
    kernel = await importKernel()
  } catch (error) {
    throw new RuntimeException(
      `Escalated: config.${setting} names middleware (${names.map((name) => `"${name}"`).join(', ')}), ` +
        `which are looked up in start/kernel.ts, but it could not be imported: ${(error as Error).message}`
    )
  }

  return entries.map((entry) => {
    if (typeof entry !== 'string') return entry

    const reference = kernel.middleware?.[entry]
    if (typeof reference !== 'function') {
      throw new RuntimeException(
        `Escalated: config.${setting} names the middleware "${entry}", but start/kernel.ts does not ` +
          `define it in router.named(). Add it there, or remove it from config.${setting}.`
      )
    }

    return reference() as ParsedNamedMiddleware
  })
}
