import router from '@adonisjs/core/services/router'

/**
 * Plays the host application's `start/kernel.ts` in integration tests: the
 * named middleware a host's `config/escalated.ts` refers to by name.
 */
export const middleware = router.named({
  auth: () => import('./auth_middleware.js'),
})
