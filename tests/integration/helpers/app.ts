import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { IgnitorFactory } from '@adonisjs/core/factories'
import type { ApplicationService } from '@adonisjs/core/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { defineConfig as defineDatabaseConfig } from '@adonisjs/lucid'
import { defineConfig as defineSessionConfig } from '@adonisjs/session'
import { defineConfig as defineDriveConfig, services as driveServices } from '@adonisjs/drive'
import User, { type TestUser } from '../fixtures/user.js'
import { hostImporter } from '../fixtures/importer.js'
import { captureCode } from '../fixtures/guest_codes.js'
import { isWidgetCsrfExempt } from '../../../src/support/widget_origins.js'

/*
|--------------------------------------------------------------------------
| Integration test application
|--------------------------------------------------------------------------
|
| Boots the package inside a real AdonisJS application: router, body parser,
| session, Lucid on an in-memory SQLite database, and the Escalated provider,
| served over HTTP on a random local port.
|
| There is one application per test process. Adonis services such as
| `@adonisjs/core/services/emitter` bind to the application that boots first,
| so a second boot in the same process would leave them pointing at a stopped
| one. Every integration spec shares this instance, and bin/test.ts closes it
| when the run ends.
|
| The host application is played by `tests/integration/fixtures`: its
| `start/kernel.ts` (named middleware), its `auth` middleware and its user model,
| reached through the aliases in that directory's package.json `imports`, as a
| host reaches `#start/kernel` and `#models/user`.
|
| The one stand-in is Inertia. Controllers render through `ctx.inertia.render`;
| the double below answers with the component and props as JSON, plus the flash
| messages that page would see. That is what an Inertia visit receives, minus
| the root view and Vite.
|
*/

/** The header the fixture `auth` middleware reads the signed-in user's id from. */
export const TEST_USER_HEADER = 'x-test-user-id'

class InertiaStandIn {
  async handle(ctx: HttpContext, next: NextFn) {
    ;(ctx as any).auth = { user: await User.find(ctx.request.header(TEST_USER_HEADER) ?? '') }
    ;(ctx as any).inertia = {
      render: (component: string, props: Record<string, unknown> = {}) =>
        ctx.response.json({ component, props, flash: ctx.session.flashMessages.all() }),
    }
    return next()
  }
}

/**
 * Plays `@adonisjs/shield`'s CSRF guard, configured the way the embedding guide
 * tells a host to: `csrf.exceptRoutes: (ctx) => isWidgetCsrfExempt(ctx)`. Like
 * shield 9 it calls a function `exceptRoutes` with the context, then refuses a
 * state-changing request without a valid token with 403.
 *
 * Off unless a spec sets `globalThis.__escalated_test_csrf`, so suites that
 * post forms without tokens are unaffected.
 */
class CsrfStandIn {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!(globalThis as any).__escalated_test_csrf) return next()
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(ctx.request.method())) return next()

    const exceptRoutes = (context: HttpContext) => isWidgetCsrfExempt(context)
    if (exceptRoutes(ctx)) return next()

    const token = ctx.request.header('x-csrf-token')
    if (!token || token !== ctx.session.get('csrf-secret')) {
      return ctx.response.forbidden({ error: 'Invalid or expired CSRF token' })
    }
    return next()
  }
}

/**
 * Without a registered handler, an exception thrown while handling a request
 * ends in an empty 200. Answer with the status and message instead, so a
 * failure shows what went wrong.
 */
class TestErrorHandler {
  async handle(error: any, ctx: HttpContext) {
    return ctx.response
      .status(error?.status ?? 500)
      .json({ error: error?.message ?? String(error), code: error?.code })
  }

  async report() {}
}

export type TestApp = {
  app: ApplicationService
  db: any
  baseUrl: string
}

let running: Promise<TestApp & { close: () => Promise<void> }> | null = null

/** The shared application, booted on first use. */
export async function testApp(): Promise<TestApp> {
  running ??= boot()
  return running
}

/** Stops the shared application, if a spec booted it. */
export async function closeTestApp() {
  if (!running) return
  const booted = await running
  running = null
  await booted.close()
}

async function boot() {
  const ignitor = new IgnitorFactory()
    .withCoreProviders()
    .withCoreConfig()
    .merge({
      rcFileContents: {
        providers: [
          () => import('@adonisjs/lucid/database_provider'),
          () => import('@adonisjs/session/session_provider'),
          () => import('@adonisjs/drive/drive_provider'),
          () => import('../../../providers/escalated_provider.js'),
        ],
        // As a host's adonisrc registers them, via `configure`.
        commands: [() => import('../../../src/commands/main.js')],
      },
      config: {
        database: defineDatabaseConfig({
          connection: 'sqlite',
          connections: {
            sqlite: {
              client: 'better-sqlite3',
              connection: { filename: ':memory:' },
              useNullAsDefault: true,
              // A single connection: each new one would open its own empty database.
              pool: { min: 1, max: 1 },
            },
          },
        }),
        // Two disks in temporary directories, neither served over HTTP: the
        // default one stands in for a private disk, `public` for the disk
        // earlier releases stored attachments on.
        drive: defineDriveConfig({
          default: 'private',
          services: {
            private: driveServices.fs({
              location: mkdtempSync(join(tmpdir(), 'escalated-private-')),
              visibility: 'private',
            }),
            public: driveServices.fs({
              location: mkdtempSync(join(tmpdir(), 'escalated-public-')),
              visibility: 'public',
            }),
          },
        }),
        session: defineSessionConfig({
          enabled: true,
          cookieName: 'escalated_test_session',
          clearWithBrowser: false,
          age: '2h',
          cookie: {},
          store: 'memory',
          stores: {},
        }),
        escalated: {
          // The default from the config stub: an alias in the host's import map,
          // which only the host's importer can resolve.
          userModel: '#models/user',
          routes: {
            enabled: true,
            prefix: 'support',
            middleware: ['auth'],
            adminMiddleware: ['auth'],
          },
          authorization: {
            isAgent: (user: TestUser) => user.role === 'agent',
            isAdmin: (user: TestUser) => user.role === 'admin',
          },
          api: { enabled: true, rateLimit: 1000, tokenExpiryDays: null, prefix: 'support/api/v1' },
          plugins: { enabled: false },
          // Codes land in fixtures/guest_codes instead of a mailbox.
          guestAccess: { sendCode: captureCode },
          ui: { enabled: true },
        },
      },
    })
    .preload(async (app) => {
      const server = await app.container.make('server')
      server.errorHandler(async () => ({ default: TestErrorHandler }) as any)

      const router = await app.container.make('router')
      router.use([
        () => import('@adonisjs/core/bodyparser_middleware'),
        () => import('@adonisjs/session/session_middleware'),
        async () => ({ default: InertiaStandIn }) as any,
        async () => ({ default: CsrfStandIn }) as any,
      ])
    })
    .create(new URL('../../../', import.meta.url), {
      // A host resolves `#start/kernel` and `#models/user` through its own import map.
      importer: hostImporter,
    })

  const app = ignitor.createApp('web')

  try {
    await app.init()
    await app.boot()
    await app.start(() => {})

    const { default: db } = await import('@adonisjs/lucid/services/db')
    await migrate(db)

    const server = await app.container.make('server')
    await server.boot()
    const httpServer: Server = createServer(server.handle.bind(server))
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
    const { port } = httpServer.address() as AddressInfo

    return {
      app,
      db,
      baseUrl: `http://127.0.0.1:${port}`,
      close: async () => {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()))
        await app.terminate()
      },
    }
  } catch (error) {
    // An app left running keeps its connection pool open and the runner never exits.
    await app.terminate()
    throw error
  }
}

/**
 * Migrations this harness cannot run, with the reason.
 *
 * 0048 calls `table.smallInteger()`, which knex does not have (its column is
 * `smallint`), so it throws on every database. Remove the entry once that
 * migration is fixed.
 */
const UNRUNNABLE_MIGRATIONS = new Set(['0048_create_escalated_agent_skills.ts'])

/**
 * Runs the package's migrations one file at a time, in the order Lucid would,
 * so that a single unrunnable file does not stop every migration after it.
 */
async function migrate(db: any) {
  const directory = fileURLToPath(new URL('../../../database/migrations/', import.meta.url))
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.ts') && !UNRUNNABLE_MIGRATIONS.has(file))
    .sort()

  for (const file of files) {
    const { default: Migration } = await import(pathToFileURL(join(directory, file)).href)
    await new Migration(db.connection(), file, false).execUp()
  }
}

/** SQLite stores a JS Date as a number, which Lucid cannot read back into a DateTime. */
export function sqlTimestamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export type Visit = {
  status: number
  location: string | null
  headers: Headers
  body: any
}

/**
 * Makes requests the way the Inertia router does, signed in as `user` (or as
 * nobody), and keeps the session cookie between them so a flash written by one
 * request is readable by the next.
 */
export class InertiaClient {
  #cookies = new Map<string, string>()

  constructor(
    protected baseUrl: string,
    protected options: { user?: TestUser | null } = {}
  ) {}

  async visit(
    method: string,
    path: string,
    options: { data?: unknown; referer?: string; headers?: Record<string, string> } = {}
  ): Promise<Visit> {
    const headers: Record<string, string> = {
      'X-Inertia': 'true',
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'text/html, application/xhtml+xml',
      ...options.headers,
    }
    if (this.options.user) headers[TEST_USER_HEADER] = String(this.options.user.id)
    if (options.data !== undefined) headers['Content-Type'] = 'application/json'
    if (options.referer) headers['Referer'] = this.baseUrl + options.referer
    if (this.#cookies.size > 0) {
      headers['Cookie'] = [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ')
    }

    const response = await fetch(this.baseUrl + path, {
      method,
      headers,
      redirect: 'manual',
      body: options.data === undefined ? undefined : JSON.stringify(options.data),
    })

    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const separator = pair.indexOf('=')
      this.#cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    }

    const text = await response.text()
    let body: any = text
    try {
      body = JSON.parse(text)
    } catch {
      // Not JSON: keep the text for the failure message.
    }

    const location = response.headers.get('location')
    return {
      status: response.status,
      location: location?.startsWith(this.baseUrl) ? location.slice(this.baseUrl.length) : location,
      headers: response.headers,
      body,
    }
  }
}
