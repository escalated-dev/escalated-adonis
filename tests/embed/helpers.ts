import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { RouteRow } from '../integration/helpers/route_table.js'

/*
|--------------------------------------------------------------------------
| Embedded-admin spec helpers
|--------------------------------------------------------------------------
|
| Each spec in this directory runs in a process of its own
| (scripts/run-embed-tests.mjs) and boots the integration application with
| its `ui.embed` configuration.
|
*/

/** The host's Edge views: its normal root view and its admin template. */
export const HOST_VIEWS = fileURLToPath(
  new URL('../integration/fixtures/embed/views/', import.meta.url)
)

/** The default route table, from before embedding existed. */
export function defaultRoutes(): RouteRow[] {
  return JSON.parse(
    readFileSync(
      new URL('../integration/fixtures/embed/default-routes.json', import.meta.url),
      'utf8'
    )
  )
}

/**
 * The admin routes that move with an embedded admin: under `/support/admin`,
 * except the newsletter admin, the two-factor enrolment page (personal, for
 * every staff user) and End Chat (an agent action), which keep their URLs.
 */
export function movesWithAdmin(row: RouteRow): boolean {
  if (!row.pattern.startsWith('/support/admin/') && row.pattern !== '/support/admin') return false
  return !(
    String(row.name).startsWith('escalated.admin.newsletters.') ||
    String(row.name).startsWith('escalated.admin.two-factor.') ||
    row.name === 'escalated.admin.chat.end'
  )
}

/** The middleware of a row, without the router middleware every route runs. */
export function routeMiddleware(row: RouteRow): string[] {
  return row.middleware.filter((name) => !name.startsWith('router:'))
}
