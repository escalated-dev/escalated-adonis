/*
|--------------------------------------------------------------------------
| NativeContext
|--------------------------------------------------------------------------
|
| Implements the PluginContext interface from @escalated-dev/plugin-sdk by
| calling Lucid ORM and AdonisJS services directly — no JSON-RPC, no
| subprocess. Because the plugins run in the same Node.js process as the
| host application, every ctx.* call is a plain async function call.
|
| One NativeContext instance is created per plugin at boot time and reused
| across all hook invocations for that plugin.
|
*/

import type {
  PluginContext,
  ConfigStore,
  DataStore,
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  BroadcastClient,
  Logger,
  TicketRepository,
  ReplyRepository,
  ContactRepository,
  TagRepository,
  DepartmentRepository,
  AgentRepository,
  QueryOptions,
  Ticket,
  Reply,
  Contact,
  Tag,
  Department,
  Agent,
  User,
} from '@escalated-dev/plugin-sdk'
import PluginStoreRecord from '../models/plugin_store_record.js'

export default class NativeContext implements PluginContext {
  readonly config: ConfigStore
  readonly store: DataStore
  readonly http: HttpClient
  readonly broadcast: BroadcastClient
  readonly log: Logger
  readonly tickets: TicketRepository
  readonly replies: ReplyRepository
  readonly contacts: ContactRepository
  readonly tags: TagRepository
  readonly departments: DepartmentRepository
  readonly agents: AgentRepository

  constructor(
    private readonly pluginName: string,
    private readonly getDispatcher: () => import('./dispatcher.js').default
  ) {
    this.config = this.buildConfigStore()
    this.store = this.buildDataStore()
    this.http = this.buildHttpClient()
    this.broadcast = this.buildBroadcastClient()
    this.log = this.buildLogger()
    this.tickets = this.buildTicketRepository()
    this.replies = this.buildReplyRepository()
    this.contacts = this.buildContactRepository()
    this.tags = this.buildTagRepository()
    this.departments = this.buildDepartmentRepository()
    this.agents = this.buildAgentRepository()
  }

  // ---------------------------------------------------------------------------
  // emit & currentUser
  // ---------------------------------------------------------------------------

  async emit(hook: string, data: unknown): Promise<void> {
    const dispatcher = this.getDispatcher()
    await dispatcher.dispatchAction(hook, data)
  }

  async currentUser(): Promise<User | null> {
    // Current user is request-scoped; we return null at the context level.
    // Individual controllers can pass the authenticated user into hook data
    // if they need it.
    return null
  }

  // ---------------------------------------------------------------------------
  // Config store
  // ---------------------------------------------------------------------------

  private buildConfigStore(): ConfigStore {
    const plugin = this.pluginName

    return {
      async get(key: string): Promise<unknown> {
        const record = await PluginStoreRecord.query()
          .where('plugin', plugin)
          .where('collection', '__config__')
          .where('key', '__config__')
          .first()

        if (!record || typeof record.data !== 'object' || record.data === null) return null
        return (record.data as Record<string, unknown>)[key] ?? null
      },

      async set(data: Record<string, unknown>): Promise<void> {
        const existing = await PluginStoreRecord.query()
          .where('plugin', plugin)
          .where('collection', '__config__')
          .where('key', '__config__')
          .first()

        const merged = Object.assign({}, existing?.data ?? {}, data)

        await PluginStoreRecord.updateOrCreate(
          { plugin, collection: '__config__', key: '__config__' },
          { data: merged }
        )
      },

      async all(): Promise<Record<string, unknown>> {
        const record = await PluginStoreRecord.query()
          .where('plugin', plugin)
          .where('collection', '__config__')
          .where('key', '__config__')
          .first()

        if (!record || typeof record.data !== 'object' || record.data === null) return {}
        return record.data as Record<string, unknown>
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Data store (generic key-value / collection storage)
  // ---------------------------------------------------------------------------

  private buildDataStore(): DataStore {
    const plugin = this.pluginName

    return {
      async get(collection: string, key: string): Promise<unknown> {
        const record = await PluginStoreRecord.query()
          .where('plugin', plugin)
          .where('collection', collection)
          .where('key', key)
          .first()
        return record?.data ?? null
      },

      async set(collection: string, key: string, value: unknown): Promise<void> {
        await PluginStoreRecord.updateOrCreate({ plugin, collection, key }, { data: value as any })
      },

      async query(
        collection: string,
        filter: Record<string, unknown>,
        options?: QueryOptions
      ): Promise<unknown[]> {
        const query = PluginStoreRecord.query()
          .where('plugin', plugin)
          .where('collection', collection)

        // Apply simple equality filters against the JSON data column.
        // For deeper filtering plugins should use get/set and filter in JS.
        for (const [field, condition] of Object.entries(filter)) {
          if (condition !== null && typeof condition === 'object') {
            // Operator map: { $gt: n }, { $in: [...] }, etc.
            for (const [op, val] of Object.entries(condition as Record<string, unknown>)) {
              const extract = `JSON_UNQUOTE(JSON_EXTRACT(data, '$.${field}'))`
              switch (op) {
                case '$gt':
                  query.whereRaw(`${extract} > ?`, [val as any])
                  break
                case '$gte':
                  query.whereRaw(`${extract} >= ?`, [val as any])
                  break
                case '$lt':
                  query.whereRaw(`${extract} < ?`, [val as any])
                  break
                case '$lte':
                  query.whereRaw(`${extract} <= ?`, [val as any])
                  break
                case '$ne':
                  query.whereRaw(`${extract} != ?`, [val as any])
                  break
                case '$in':
                  query.whereIn(
                    PluginStoreRecord.knexQuery().client.raw(extract) as any,
                    val as any[]
                  )
                  break
              }
            }
          } else {
            query.whereRaw(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${field}')) = ?`, [condition as any])
          }
        }

        if (options?.orderBy) {
          const dir = options.order === 'desc' ? 'desc' : 'asc'
          query.orderByRaw(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${options.orderBy}')) ${dir}`)
        }

        if (options?.limit) {
          query.limit(options.limit)
        }

        const rows = await query
        return rows.map((r) =>
          Object.assign({ _id: r.id }, typeof r.data === 'object' && r.data !== null ? r.data : {})
        )
      },

      async insert(collection: string, data: Record<string, unknown>): Promise<unknown> {
        const record = await PluginStoreRecord.create({
          plugin,
          collection,
          key: (data['key'] as string | undefined) ?? null,
          data,
        })
        return Object.assign(
          { _id: record.id },
          typeof record.data === 'object' && record.data !== null ? record.data : {}
        )
      },

      async update(
        collection: string,
        key: string,
        data: Record<string, unknown>
      ): Promise<unknown> {
        const record = await PluginStoreRecord.query()
          .where('plugin', plugin)
          .where('collection', collection)
          .where('key', key)
          .firstOrFail()

        const merged = Object.assign(
          {},
          typeof record.data === 'object' && record.data !== null ? record.data : {},
          data
        )
        record.data = merged
        await record.save()

        return Object.assign({ _id: record.id }, merged)
      },

      async delete(collection: string, key: string): Promise<void> {
        await PluginStoreRecord.query()
          .where('plugin', plugin)
          .where('collection', collection)
          .where('key', key)
          .delete()
      },
    }
  }

  // ---------------------------------------------------------------------------
  // HTTP client (thin wrapper around the native fetch available in Node 18+)
  // ---------------------------------------------------------------------------

  private buildHttpClient(): HttpClient {
    const makeRequest = async (
      method: string,
      url: string,
      options?: HttpRequestOptions
    ): Promise<HttpResponse> => {
      const headers: Record<string, string> = { ...(options?.headers ?? {}) }
      let body: string | undefined

      if (options?.json !== undefined) {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify(options.json)
      } else if (options?.body !== undefined) {
        body = options.body
      }

      const controller = new AbortController()
      const timeout = options?.timeout ?? 30_000
      const timer = setTimeout(() => controller.abort(), timeout)

      let response: Response
      try {
        response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      return {
        status: response.status,
        headers: responseHeaders,
        async json(): Promise<unknown> {
          return response.clone().json()
        },
        async text(): Promise<string> {
          return response.clone().text()
        },
      }
    }

    return {
      get: (url, opts) => makeRequest('GET', url, opts),
      post: (url, opts) => makeRequest('POST', url, opts),
      put: (url, opts) => makeRequest('PUT', url, opts),
      delete: (url, opts) => makeRequest('DELETE', url, opts),
    }
  }

  // ---------------------------------------------------------------------------
  // Broadcast (WebSocket / Soketi / Pusher via AdonisJS transmit / ws)
  // ---------------------------------------------------------------------------

  private buildBroadcastClient(): BroadcastClient {
    const pluginName = this.pluginName

    const tryBroadcast = async (channel: string, event: string, data: unknown): Promise<void> => {
      try {
        // Attempt to use AdonisJS transmit service if available
        const { default: transmit } = await import('@adonisjs/transmit/services/main').catch(
          () => ({ default: null })
        )

        if (transmit) {
          await (transmit as any).broadcast(channel, { event, data })
          return
        }
      } catch {
        // transmit not installed — fall through
      }

      console.warn(
        `[Escalated Bridge] Plugin "${pluginName}" tried to broadcast to "${channel}" ` +
          `(event: "${event}") but no broadcast adapter is available.`
      )
    }

    return {
      toChannel: (channel, event, data) => tryBroadcast(channel, event, data),
      toUser: (userId, event, data) => tryBroadcast(`private-user.${userId}`, event, data),
      toTicket: (ticketId, event, data) => tryBroadcast(`private-ticket.${ticketId}`, event, data),
    }
  }

  // ---------------------------------------------------------------------------
  // Logger
  // ---------------------------------------------------------------------------

  private buildLogger(): Logger {
    const name = this.pluginName

    return {
      info: (msg, data) =>
        console.info(`[Plugin:${name}] ${msg}`, ...(data !== undefined ? [data] : [])),
      warn: (msg, data) =>
        console.warn(`[Plugin:${name}] ${msg}`, ...(data !== undefined ? [data] : [])),
      error: (msg, data) =>
        console.error(`[Plugin:${name}] ${msg}`, ...(data !== undefined ? [data] : [])),
      debug: (msg, data) =>
        console.debug(`[Plugin:${name}] ${msg}`, ...(data !== undefined ? [data] : [])),
    }
  }

  // ---------------------------------------------------------------------------
  // Ticket repository
  // ---------------------------------------------------------------------------

  private buildTicketRepository(): TicketRepository {
    return {
      async find(id): Promise<Ticket | null> {
        const { default: TicketModel } = await import('../models/ticket.js')
        const row = await TicketModel.find(id)
        return row ? NativeContext.serializeTicket(row) : null
      },

      async query(filter): Promise<Ticket[]> {
        const { default: TicketModel } = await import('../models/ticket.js')
        const q = TicketModel.query()
        for (const [col, val] of Object.entries(filter)) {
          q.where(col, val as any)
        }
        const rows = await q
        return rows.map(NativeContext.serializeTicket)
      },

      async create(data): Promise<Ticket> {
        const { default: TicketModel } = await import('../models/ticket.js')
        const reference = await TicketModel.generateReference()
        const row = await TicketModel.create({ reference, ...data } as any)
        return NativeContext.serializeTicket(row)
      },

      async update(id, data): Promise<Ticket> {
        const { default: TicketModel } = await import('../models/ticket.js')
        const row = await TicketModel.findOrFail(id)
        row.merge(data as any)
        await row.save()
        return NativeContext.serializeTicket(await row.refresh())
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Reply repository
  // ---------------------------------------------------------------------------

  private buildReplyRepository(): ReplyRepository {
    return {
      async find(id): Promise<Reply | null> {
        const { default: ReplyModel } = await import('../models/reply.js')
        const row = await ReplyModel.find(id)
        return row ? NativeContext.serializeReply(row) : null
      },

      async query(filter): Promise<Reply[]> {
        const { default: ReplyModel } = await import('../models/reply.js')
        const q = ReplyModel.query()
        for (const [col, val] of Object.entries(filter)) {
          q.where(col, val as any)
        }
        const rows = await q
        return rows.map(NativeContext.serializeReply)
      },

      async create(data): Promise<Reply> {
        const { default: ReplyModel } = await import('../models/reply.js')
        const row = await ReplyModel.create(data as any)
        return NativeContext.serializeReply(row)
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Contact repository (delegates to the host app's user model)
  // ---------------------------------------------------------------------------

  private buildContactRepository(): ContactRepository {
    const getModel = async () => {
      const config: any = (globalThis as any).__escalated_config ?? {}
      const modelName: string = config.userModel ?? 'User'
      // Dynamic import of the host application's user model
      try {
        const mod = await import(`#models/${modelName.toLowerCase()}`)
        return mod.default
      } catch {
        // Fallback: try common AdonisJS paths
        const paths = [
          `${process.cwd()}/app/models/${modelName.toLowerCase()}.js`,
          `${process.cwd()}/app/models/user.js`,
        ]
        for (const p of paths) {
          try {
            const { default: M } = await import(`file:///${p.replace(/\\/g, '/')}`)
            return M
          } catch {
            // continue
          }
        }
        throw new Error(`[Escalated Bridge] Could not resolve user model "${modelName}"`)
      }
    }

    return {
      async find(id): Promise<Contact | null> {
        const Model = await getModel()
        const row = await Model.find(id)
        return row ? { id: row.id, name: row.name ?? '', email: row.email ?? '' } : null
      },

      async findByEmail(email): Promise<Contact | null> {
        const Model = await getModel()
        const row = await Model.query().where('email', email).first()
        return row ? { id: row.id, name: row.name ?? '', email: row.email ?? '' } : null
      },

      async create(data): Promise<Contact> {
        const Model = await getModel()
        const row = await Model.create(data)
        return { id: row.id, name: row.name ?? '', email: row.email ?? '' }
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Tag repository
  // ---------------------------------------------------------------------------

  private buildTagRepository(): TagRepository {
    return {
      async all(): Promise<Tag[]> {
        const { default: TagModel } = await import('../models/tag.js')
        const rows = await TagModel.all()
        return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }))
      },

      async create(data): Promise<Tag> {
        const { default: TagModel } = await import('../models/tag.js')
        const row = await TagModel.create({ name: data.name } as any)
        return { id: row.id, name: row.name, slug: row.slug }
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Department repository
  // ---------------------------------------------------------------------------

  private buildDepartmentRepository(): DepartmentRepository {
    return {
      async all(): Promise<Department[]> {
        const { default: DeptModel } = await import('../models/department.js')
        const rows = await DeptModel.all()
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          is_active: r.isActive,
        }))
      },

      async find(id): Promise<Department | null> {
        const { default: DeptModel } = await import('../models/department.js')
        const row = await DeptModel.find(id)
        if (!row) return null
        return { id: row.id, name: row.name, slug: row.slug, is_active: row.isActive }
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Agent repository (delegates to host app's user model, same as contacts)
  // ---------------------------------------------------------------------------

  private buildAgentRepository(): AgentRepository {
    const getModel = async () => {
      const config: any = (globalThis as any).__escalated_config ?? {}
      const modelName: string = config.userModel ?? 'User'
      try {
        const mod = await import(`#models/${modelName.toLowerCase()}`)
        return mod.default
      } catch {
        const paths = [
          `${process.cwd()}/app/models/${modelName.toLowerCase()}.js`,
          `${process.cwd()}/app/models/user.js`,
        ]
        for (const p of paths) {
          try {
            const { default: M } = await import(`file:///${p.replace(/\\/g, '/')}`)
            return M
          } catch {
            // continue
          }
        }
        throw new Error(`[Escalated Bridge] Could not resolve user model "${modelName}"`)
      }
    }

    return {
      async all(): Promise<Agent[]> {
        const Model = await getModel()
        const rows = await Model.all()
        return rows.map((r: any) => ({ id: r.id, name: r.name ?? '', email: r.email ?? '' }))
      },

      async find(id): Promise<Agent | null> {
        const Model = await getModel()
        const row = await Model.find(id)
        return row ? { id: row.id, name: row.name ?? '', email: row.email ?? '' } : null
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Serialization helpers — convert Lucid model instances to SDK plain objects
  // ---------------------------------------------------------------------------

  private static serializeTicket(row: any): Ticket {
    return {
      id: row.id,
      title: row.subject,
      status: row.status,
      priority: row.priority,
      assigned_to: row.assignedTo ?? null,
      department_id: row.departmentId ?? null,
      requester_id: row.requesterId ?? null,
      requester_type: row.requesterType ?? null,
      metadata: row.metadata ?? null,
      created_at: row.createdAt?.toISO?.() ?? String(row.createdAt),
      updated_at: row.updatedAt?.toISO?.() ?? String(row.updatedAt),
    }
  }

  private static serializeReply(row: any): Reply {
    return {
      id: row.id,
      ticket_id: row.ticketId,
      body: row.body,
      is_internal_note: row.isInternalNote,
      author_id: row.authorId ?? null,
      author_type: row.authorType ?? null,
      created_at: row.createdAt?.toISO?.() ?? String(row.createdAt),
      updated_at: row.updatedAt?.toISO?.() ?? String(row.updatedAt),
    }
  }
}
