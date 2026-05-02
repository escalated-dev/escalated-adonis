/*
|--------------------------------------------------------------------------
| Routing helpers
|--------------------------------------------------------------------------
|
| AdonisJS 7 made `response.redirect().toRoute()` and the related
| `urlFor` / `signedUrlFor` URL builders type-safe against a host-augmented
| `RoutesList` interface. Plugins can't know the host's full route set
| (and a permissive plugin-side augmentation of `RoutesList` runs into
| TypeScript's module-augmentation rules: the original interface is
| re-exported via several paths so a plain `declare module` augmentation
| in the plugin doesn't reach every relative import inside the framework).
|
| These helpers wrap the underlying runtime calls (which still accept any
| string identifier — only the static types tightened) so plugin code can
| call them with plugin-defined route names like
| `escalated.admin.tickets.index` without fighting the new conditional
| types.
|
*/

import type { HttpContext } from '@adonisjs/core/http'

/**
 * Redirect to a named route. Mirrors the runtime semantics of
 * `response.redirect().toRoute(name, params?)` but accepts any string
 * identifier (the route name set is registered by the plugin's own
 * `route_registrar` and is not part of the host's `RoutesList`).
 */
export function redirectToRoute(
  response: HttpContext['response'],
  name: string,
  params?: Record<string, any>
): void {
  // The Adonis 7 type for `.toRoute(...args)` collapses to `[]` when the
  // host hasn't augmented `RoutesList`, so we cast to a compatible runtime
  // signature. The runtime still accepts (name, params) unchanged.
  const redirect = response.redirect() as unknown as {
    toRoute(name: string, params?: Record<string, any>): void
  }
  redirect.toRoute(name, params)
}
