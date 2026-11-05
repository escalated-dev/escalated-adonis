/*
|--------------------------------------------------------------------------
| Route table
|--------------------------------------------------------------------------
|
| Every route the package registered, as plain data: name, pattern, methods,
| the middleware that runs for it (named references by name and arguments,
| functions by name) and its handler (controller method). Used to prove that
| a default install's routes are exactly what they were before a change
| (tests/integration/fixtures/embed/default-routes.json).
|
| The harness's own routes (`/__test/*`, the `escalated.__probe` stand-in and
| the host route) are left out.
|
*/

export type RouteRow = {
  name: string | null
  pattern: string
  methods: string[]
  middleware: string[]
  handler: string
}

const HARNESS = new Set(['escalated.__probe', 'host.missing'])

function describeMiddleware(entry: any): string {
  if (entry && typeof entry === 'object' && typeof entry.name === 'string' && entry.name !== '') {
    return entry.args === undefined ? entry.name : `${entry.name}(${JSON.stringify(entry.args)})`
  }
  // Router middleware (`router.use`): a lazy import, named by what it imports.
  const source = String(entry?.reference ?? entry)
  const imported = /import\(["']([^"']+)["']\)/.exec(source) ?? /default:\s*(\w+)/.exec(source)
  return imported ? `router:${imported[1]}` : 'router:anonymous'
}

function describeHandler(handler: any): string {
  if (typeof handler === 'function') return handler.name || 'closure'
  if (handler && typeof handler.method === 'string') return `${handler.name}#${handler.method}`
  if (handler && typeof handler.name === 'string') return handler.name
  return 'closure'
}

/** The routes of `router` (after commit), in registration order, which decides matching. */
export function routeTable(router: any): RouteRow[] {
  const rows: RouteRow[] = []
  for (const routes of Object.values(router.toJSON() as Record<string, any[]>)) {
    for (const route of routes) {
      if (HARNESS.has(route.name) || String(route.pattern).startsWith('/__test')) continue
      rows.push({
        name: route.name ?? null,
        pattern: route.pattern,
        methods: [...route.methods].sort(),
        middleware: [...route.middleware.all()].map(describeMiddleware),
        handler: describeHandler(route.handler),
      })
    }
  }
  return rows
}
