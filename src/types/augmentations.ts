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
*/

import '@adonisjs/auth/initialize_auth_middleware'
import '@adonisjs/session/session_middleware'
import '@adonisjs/inertia/inertia_middleware'
