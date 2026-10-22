import type { HttpContext } from '@adonisjs/core/http'
import { connectionName, tablePrefix } from '../helpers/config.js'
import Ticket from '../models/ticket.js'
import { getRenderer } from '../rendering/renderer.js'

const SQLITE_CLIENTS = ['sqlite', 'sqlite3', 'better-sqlite3', 'libsql']

/** How long a probe may take before the connection is reported unreachable. */
const PROBE_TIMEOUT_MS = 5_000

export type ConnectionDescription = {
  name: string
  driver: string | null
  database: string | null
  is_current: boolean
  is_host_default: boolean
  reachable: boolean
  migrated: boolean
  ticket_count: number | null
  error: string | null
}

async function lucid() {
  const { default: db } = await import('@adonisjs/lucid/services/db')
  return db
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`No answer within ${PROBE_TIMEOUT_MS / 1000} seconds.`)),
      PROBE_TIMEOUT_MS
    )
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

/**
 * The database screen. Escalated's tables live on the Lucid connection named
 * by `connection` in config/escalated.ts (or the application's default), and
 * this package has no way to change that at runtime, so the screen is always
 * read-only (`pinnedByConfig`): it shows each configured connection, which one
 * Escalated uses, and whether it is reachable and migrated. Mirrors the props
 * of escalated-laravel's `Admin\DatabaseConnectionController`.
 */
export default class AdminDatabaseConnectionController {
  async index(ctx: HttpContext) {
    const db = await lucid()
    const names = [...db.manager.connections.keys()].sort()

    return getRenderer().render(ctx, 'Escalated/Admin/Settings/DatabaseConnection', {
      connections: await Promise.all(names.map((name) => this.describe(name))),
      current: this.current(db),
      hostDefault: db.primaryConnectionName ?? null,
      pinnedByConfig: true,
      tablePrefix: tablePrefix(),
    })
  }

  /**
   * Probe one configured connection without changing anything.
   */
  async test({ request, response }: HttpContext) {
    const name = request.input('connection')
    const db = await lucid()

    if (typeof name !== 'string' || name.trim() === '' || name.length > 64) {
      return response.status(422).json({
        errors: { connection: ['The connection field is required.'] },
      })
    }
    if (!db.manager.has(name)) {
      return response.status(422).json({
        errors: { connection: [`[${name}] is not configured in config/database.ts.`] },
      })
    }

    return response.json(await this.describe(name))
  }

  /**
   * Switching is not supported: the connection is part of the deployed
   * configuration.
   */
  async update({ response, session }: HttpContext) {
    session.flash(
      'error',
      'The database connection is set in configuration and cannot be changed from here.'
    )
    return response.redirect().back()
  }

  protected current(db: Awaited<ReturnType<typeof lucid>>): string | null {
    return connectionName() ?? db.primaryConnectionName ?? null
  }

  protected async describe(name: string): Promise<ConnectionDescription> {
    const db = await lucid()
    const config: any = db.manager.get(name)?.config ?? {}

    const description: ConnectionDescription = {
      name,
      driver: typeof config.client === 'string' ? config.client : null,
      database: this.databaseLabel(config),
      is_current: name === this.current(db),
      is_host_default: name === db.primaryConnectionName,
      reachable: false,
      migrated: false,
      ticket_count: null,
      error: null,
    }

    try {
      const client = db.connection(name)
      await withTimeout(client.rawQuery('select 1'))
      description.reachable = true

      description.migrated = Boolean(await withTimeout(client.schema.hasTable(Ticket.table)))
      if (description.migrated) {
        const [row] = await withTimeout(client.from(Ticket.table).count('* as total'))
        description.ticket_count = Number(row?.total ?? 0)
      }
    } catch (error: any) {
      // Shown to an admin only, to say why a connection is not usable.
      description.error = error?.message ?? String(error)
    }

    return description
  }

  /** The database name and host, never credentials. */
  protected databaseLabel(config: any): string | null {
    const connection = config.connection
    if (!connection || typeof connection !== 'object') return null

    if (SQLITE_CLIENTS.includes(config.client)) {
      return typeof connection.filename === 'string' && connection.filename !== ''
        ? connection.filename
        : null
    }

    const database = connection.database
    if (typeof database !== 'string' || database === '') return null
    const host = connection.host
    return typeof host === 'string' && host !== '' ? `${database} @ ${host}` : database
  }
}
