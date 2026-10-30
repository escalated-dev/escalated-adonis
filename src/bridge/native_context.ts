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
import { AsyncLocalStorage } from 'node:async_hooks'
import PluginStoreRecord from '../models/plugin_store_record.js'
import { resolveUserModel } from '../support/user_model.js'
import { isReservedHook } from '../support/plugin_events.js'
import { guardPluginAction } from '../support/plugin_action_guard.js'

/**
 * The user a plugin call is made for: the viewer while a widget badge is
 * asked, nobody for a cron schedule (domain-model/plugin-contract.md).
 * `ctx.currentUser()` answers with it.
 */
const actingUser = new AsyncLocalStorage<User | null>()

/** The model type of each acting user, the `author_type` of what it writes. */
const actingTypes = new WeakMap<User, string>()

/** Runs `fn` with `user` (an authenticated host user, or null) as the acting user. */
export function actingAs<T>(user: any, fn: () => Promise<T>): Promise<T> {
  const acting: User | null =
    user && user.id !== undefined && user.id !== null
      ? { id: user.id, name: String(user.name ?? ''), email: String(user.email ?? '') }
      : null
  if (acting) actingTypes.set(acting, String(user.constructor?.name ?? 'User'))
  return actingUser.run(acting, fn)
}

/**
 * The acting user as TicketService takes an actor (`id` and the model type
 * as `constructor.name`), or null when the call is made for nobody.
 */
function actingActor(): { id: number; constructor: { name: string } } | null {
  const user = actingUser.getStore() ?? null
  if (!user) return null
  return { id: user.id as number, constructor: { name: actingTypes.get(user) ?? 'User' } }
}

/**
 * The fields each ctx write takes (domain-model/plugin-contract.md). title
 * and body are the SDK's names for subject and description. Any other key is
 * an error, never an attribute: a plugin never names an author, a requester,
 * an assignee or a reply's flags.
 */
const TICKET_UPDATE_FIELDS = [
  'subject',
  'title',
  'body',
  'description',
  'priority',
  'status',
  'department_id',
  'ticket_type',
  'metadata',
]
const TICKET_CREATE_FIELDS = [
  ...TICKET_UPDATE_FIELDS,
  'channel',
  'contact_id',
  'requester_email',
  'requester_name',
]
const REPLY_CREATE_FIELDS = ['ticket_id', 'body', 'is_internal']
const CONTACT_CREATE_FIELDS = ['name', 'email']

const PRIORITIES = ['low', 'medium', 'high', 'urgent', 'critical']

/** The plugin's data, refused when it holds a key outside `allowed`. */
function contractFields(data: unknown, allowed: string[], method: string): Record<string, any> {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${method} requires a data object`)
  }
  const unknown = Object.keys(data).filter((key) => !allowed.includes(key))
  if (unknown.length > 0) throw new Error(`${method} does not accept: ${unknown.join(', ')}`)
  return data as Record<string, any>
}

/** A trimmed, non-empty string, or undefined when absent or blank. */
function optionalText(data: Record<string, any>, key: string, method: string): string | undefined {
  const value = data[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${method}: ${key} must be a string`)
  }
  const text = String(value).trim()
  return text === '' ? undefined : text
}

/** Ticket attributes from the contract fields a plugin sent. */
async function ticketAttributes(data: Record<string, any>, method: string) {
  const attributes: Record<string, any> = {}
  const subject = optionalText(data, 'subject', method) ?? optionalText(data, 'title', method)
  if (subject !== undefined) attributes.subject = subject
  if ('description' in data || 'body' in data) {
    const description = data.description ?? data.body ?? ''
    if (typeof description !== 'string') throw new Error(`${method}: description must be a string`)
    attributes.description = description
  }
  const priority = optionalText(data, 'priority', method)
  if (priority !== undefined) {
    if (!PRIORITIES.includes(priority)) throw new Error(`${method}: unknown priority "${priority}"`)
    attributes.priority = priority
  }
  const status = optionalText(data, 'status', method)
  if (status !== undefined) attributes.status = status
  if ('department_id' in data) {
    if (data.department_id === null) {
      attributes.departmentId = null
    } else {
      const { default: Department } = await import('../models/department.js')
      const department = await Department.find(Number(data.department_id))
      if (!department) throw new Error(`${method}: no such department`)
      attributes.departmentId = department.id
    }
  }
  const ticketType = optionalText(data, 'ticket_type', method)
  if (ticketType !== undefined) attributes.ticketType = ticketType
  if ('metadata' in data) {
    if (
      data.metadata !== null &&
      (typeof data.metadata !== 'object' || Array.isArray(data.metadata))
    ) {
      throw new Error(`${method}: metadata must be an object`)
    }
    attributes.metadata = data.metadata
  }
  return attributes
}

/**
 * ctx.tickets.query filter keys (plugin contract) and the column each reads.
 * Any other key is an error, never a column name.
 */
const TICKET_FILTERS: Record<string, string> = {
  id: 'id',
  reference: 'reference',
  status: 'status',
  priority: 'priority',
  channel: 'channel',
  ticket_type: 'ticket_type',
  department_id: 'department_id',
  requester_id: 'requester_id',
  contact_id: 'contact_id',
  assigned_to: 'assigned_to',
}

/** The most rows a ticket or reply query hands back. */
const QUERY_LIMIT = 500

/** Equality filters only: an object of single values. */
function contractFilter(filter: unknown, method: string): Array<[string, unknown]> {
  if (filter === null || filter === undefined) return []
  if (typeof filter !== 'object' || Array.isArray(filter)) {
    throw new Error(`${method} requires an object filter`)
  }
  const entries = Object.entries(filter as Record<string, unknown>)
  for (const [key, value] of entries) {
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
      throw new Error(`${method} filter "${key}" must be a single value`)
    }
  }
  return entries
}

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
    // A plugin may not impersonate a host event or lifecycle action.
    if (isReservedHook(hook)) {
      console.warn(
        `[Escalated Bridge] dropped ctx.emit of reserved hook "${hook}" from ${this.pluginName}`
      )
      return
    }
    const dispatcher = this.getDispatcher()
    await guardPluginAction(hook, () => dispatcher.dispatchAction(hook, data))
  }

  async currentUser(): Promise<User | null> {
    // The acting user of the call being served (see actingAs), else nobody.
    return actingUser.getStore() ?? null
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
                case '$in': {
                  // Reach into the active Lucid connection for a raw SQL
                  // column reference (`$in` needs an unquoted column expr,
                  // not a parameter binding). `knexQuery()` is exposed on
                  // a query builder instance, not statically on the model.
                  const knex = PluginStoreRecord.query().knexQuery.client
                  query.whereIn(knex.raw(extract) as any, val as any[])
                  break
                }
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
        for (const [key, val] of contractFilter(filter, 'ctx.tickets.query')) {
          const column = TICKET_FILTERS[key]
          if (!column) throw new Error(`ctx.tickets.query cannot filter by "${key}"`)
          val === null ? q.whereNull(column) : q.where(column, val as any)
        }
        const rows = await q.orderBy('id', 'asc').limit(QUERY_LIMIT)
        return rows.map(NativeContext.serializeTicket)
      },

      async create(input): Promise<Ticket> {
        const method = 'ctx.tickets.create'
        const data = contractFields(input, TICKET_CREATE_FIELDS, method)
        const attributes = await ticketAttributes(data, method)
        if (!attributes.subject) throw new Error(`${method} requires subject`)
        const { default: TicketModel } = await import('../models/ticket.js')
        const { default: Contact } = await import('../models/contact.js')

        // The requester is a contact, never a user id the plugin names.
        let contactId: number | null = null
        if (data.contact_id !== undefined && data.contact_id !== null) {
          const contact = await Contact.find(Number(data.contact_id))
          if (!contact) throw new Error(`${method}: no such contact`)
          contactId = contact.id
        } else {
          const email = optionalText(data, 'requester_email', method)
          if (email !== undefined) {
            if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
              throw new Error(`${method}: requester_email is not an email address`)
            }
            const name = optionalText(data, 'requester_name', method) ?? null
            const contact = await Contact.findOrCreateByEmail(email, name)
            contactId = contact.id
          }
        }

        // Through the ticket service, like a ticket opened over the API: the
        // opening activity, SLA, ticket.created, workflows and webhooks.
        const { default: TicketService } = await import('../services/ticket_service.js')
        const row = await new TicketService().createForSystem(
          {
            ...attributes,
            subject: attributes.subject,
            channel: optionalText(data, 'channel', method) ?? 'api',
            contactId,
          },
          actingActor() ?? undefined
        )
        return NativeContext.serializeTicket(await TicketModel.findOrFail(row.id))
      },

      async update(id, input): Promise<Ticket> {
        const method = 'ctx.tickets.update'
        const data = contractFields(input, TICKET_UPDATE_FIELDS, method)
        const attributes = await ticketAttributes(data, method)
        const { default: TicketModel } = await import('../models/ticket.js')
        const row = await TicketModel.findOrFail(id)
        await NativeContext.updateThroughService(row, attributes, actingActor() ?? undefined)
        return NativeContext.serializeTicket(await TicketModel.findOrFail(row.id))
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
        for (const [key, val] of contractFilter(filter, 'ctx.replies.query')) {
          if (key === 'ticket_id') q.where('ticket_id', val as any)
          else if (key === 'is_internal')
            q.where('is_internal_note', val === true || val === 1 || val === '1' || val === 'true')
          else if (key === 'type') q.where('type', String(val))
          else throw new Error(`ctx.replies.query cannot filter by "${key}"`)
        }
        const rows = await q.orderBy('id', 'asc').limit(QUERY_LIMIT)
        return rows.map(NativeContext.serializeReply)
      },

      async create(input): Promise<Reply> {
        const method = 'ctx.replies.create'
        const data = contractFields(input, REPLY_CREATE_FIELDS, method)
        const { default: TicketModel } = await import('../models/ticket.js')
        const ticketId = Number(data.ticket_id)
        const ticket = Number.isInteger(ticketId) ? await TicketModel.find(ticketId) : null
        if (!ticket) throw new Error(`${method} requires an existing ticket_id`)
        const body = optionalText(data, 'body', method)
        if (body === undefined) throw new Error(`${method} requires body`)
        const internal =
          data.is_internal === true || data.is_internal === 1 || data.is_internal === 'true'

        // The author is the acting user (the signed-in user of the request
        // the plugin is serving), or nobody: a plugin never names it. Through
        // the ticket service, like a reply over the API: activity log,
        // reply.created / note.created, workflows and webhooks.
        const { default: TicketService } = await import('../services/ticket_service.js')
        const service = new TicketService()
        const author = actingActor()
        const row = internal
          ? await service.addNote(ticket, author, body)
          : await service.reply(ticket, author, body)
        return NativeContext.serializeReply(row)
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Contact repository (delegates to the host app's user model)
  // ---------------------------------------------------------------------------

  private buildContactRepository(): ContactRepository {
    const getModel = () => resolveUserModel()

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

      async create(input): Promise<Contact> {
        const data = contractFields(input, CONTACT_CREATE_FIELDS, 'ctx.contacts.create')
        const Model = await getModel()
        const row = await Model.create({ name: data.name, email: data.email })
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
    const getModel = () => resolveUserModel()

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

  /**
   * ctx.tickets.update through TicketService, each change the way the API
   * makes it, so it is logged and announced (ticket.updated,
   * ticket.priority_changed, ticket.department_changed,
   * ticket.status_changed). A status change the transitions do not allow is
   * refused before anything is written.
   */
  private static async updateThroughService(
    row: any,
    attributes: Record<string, any>,
    causer: any
  ): Promise<void> {
    const { default: TicketService } = await import('../services/ticket_service.js')
    const { default: CustomStatus } = await import('../models/custom_status.js')
    const { canTransitionTo } = await import('../types.js')
    const service = new TicketService()

    let moveTo: { status: string; custom: any } | null = null
    if (attributes.status !== undefined) {
      const target = await CustomStatus.resolveTarget(attributes.status)
      const customChanges = (target.custom?.id ?? null) !== (row.ticketStatusId ?? null)
      if (target.status !== row.status || customChanges) {
        if (target.status !== row.status && !canTransitionTo(row.status, target.status as any)) {
          throw new Error(`Cannot transition from ${row.status} to ${target.status}`)
        }
        moveTo = target
      }
    }

    // Fields TicketService.update does not take: written here, announced by
    // the same ticket.updated.
    const direct: Record<string, any> = {}
    if (attributes.ticketType !== undefined && attributes.ticketType !== row.ticketType) {
      direct.ticketType = attributes.ticketType
    }
    if (attributes.departmentId === null && row.departmentId !== null) direct.departmentId = null
    const details: Record<string, any> = {}
    for (const key of ['subject', 'description', 'metadata']) {
      if (attributes[key] !== undefined) details[key] = attributes[key]
    }
    if (Object.keys(direct).length > 0) {
      row.merge(direct)
      await row.save()
    }
    if (Object.keys(details).length > 0 || Object.keys(direct).length > 0) {
      await service.update(row, details)
    }

    if (attributes.priority !== undefined && attributes.priority !== row.priority) {
      await service.changePriority(row, attributes.priority, causer)
    }
    if (
      attributes.departmentId !== undefined &&
      attributes.departmentId !== null &&
      attributes.departmentId !== row.departmentId
    ) {
      await service.changeDepartment(row, attributes.departmentId, causer)
    }
    if (moveTo) await service.changeStatus(row, attributes.status, causer)
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
