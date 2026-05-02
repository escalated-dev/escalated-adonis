/*
|--------------------------------------------------------------------------
| Adonis framework type augmentations needed during standalone package build
|--------------------------------------------------------------------------
|
| The package calls ctx.auth, ctx.session and ctx.inertia throughout its
| controllers. Those properties are added to HttpContext by the host app's
| middleware stack (auth_provider, session_middleware, inertia_middleware),
| so when the host app runs, TypeScript sees the augmentations and compiles.
|
| When the package is built in isolation (npm run build) nothing imports
| those middleware, so TS reports "Property 'session' does not exist on
| HttpContext" and similar. Importing the middleware as types below pulls
| in the d.ts files that augment @adonisjs/core/http, keeping the package
| self-contained and compilable without touching its runtime output.
|
| AdonisJS 7 also made Router.toRoute() and Inertia.render() type-safe
| against host-augmented `RoutesList` and `InertiaPages` interfaces. A
| plugin can't know the host's full route name set or page component set
| ahead of time, so we widen both with permissive index signatures so the
| package's own controllers (which use plugin-defined route names like
| `escalated.admin.tickets.index` and Inertia component paths like
| `Escalated/Admin/Tickets/Index`) type-check in isolation without losing
| host-side specificity (host augmentations merge on top of these).
|
*/

import '@adonisjs/auth/initialize_auth_middleware'
import '@adonisjs/session/session_middleware'
import '@adonisjs/inertia/inertia_middleware'

declare module '@adonisjs/inertia/types' {
  /**
   * Permissive InertiaPages augmentation. Lets `ctx.inertia.render('SomeComponent', props)`
   * accept any string component path. The host app may further narrow this with
   * its own page set.
   */
  interface InertiaPages {
    [component: string]: Record<string, any>
  }
}
