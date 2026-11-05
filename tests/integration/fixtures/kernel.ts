import router from '@adonisjs/core/services/router'

/**
 * Plays the host application's `start/kernel.ts` in integration tests: the
 * named middleware a host's `config/escalated.ts` refers to by name.
 */
export const middleware = router.named({
  auth: () => import('./auth_middleware.js'),
  // The host admin panel's own sign-in and staff check, and its security
  // headers, for the embedded-admin specs (tests/embed).
  hostPanel: () => import('./embed/host_panel_middleware.js'),
  hostHeaders: () => import('./embed/host_headers_middleware.js'),
})
