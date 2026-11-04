import Ticket from '../models/ticket.js'
import SavedView from '../models/saved_view.js'
import { getConfig } from '../helpers/config.js'
import { t } from '../support/i18n.js'
import { applyListFilters, flag } from '../support/ticket_list_filters.js'

export type Filters = Record<string, any>

export interface InboxView {
  id: number | string
  name: string
  filters: Filters
}

/** A queue: its key and title, and its own filters (what its counts and stats are over). */
export interface InboxQueue {
  key: string
  title: string
  filters: Filters
}

export interface InboxSummary {
  counts: { mine: number; unassigned: number; all: number }
  views: Array<{ id: number | string; name: string; count: number; filters: Filters }>
  stats: { open: number; urgent: number; sla_at_risk: number; resolved_today: number }
}

export const SESSION_KEY = 'escalated_agent_inbox_queue'

/** Saved views beyond this many are not listed, so the counts stay bounded. */
export const MAX_SAVED_VIEWS = 50

/** Query keys that pick a page or an order, never which tickets are in a queue. */
const PRESENTATION_KEYS = ['page', 'per_page', 'view']

const BUILT_IN_VIEW_IDS = [
  'urgent',
  'sla_at_risk',
  'waiting_on_me',
  'waiting_on_customer',
  'recently_updated',
]

const cache = new Map<string, { expires: number; value: InboxSummary }>()

/** Forget every cached inbox (tests, or a host that changed tickets in bulk). */
export function clearAgentInboxCache(): void {
  cache.clear()
}

/**
 * The agent panel's `inbox` and `queue` props (shared frontend
 * docs/agent-panel.md), as escalated-laravel's AgentInbox sends them.
 *
 * Every number is a count over the same filters the ticket list applies,
 * inside the request's ticket-access scope, so it is what the agent would
 * see by opening that list. Rail counts (`counts`, `views`) are of
 * unresolved, unsnoozed tickets; `stats` are for the current queue.
 */
export default class AgentInbox {
  #views: InboxView[] | null = null

  constructor(protected agentId: any) {}

  /** Translate `assigned=me` and `assigned_to=me` into the agent's id. */
  normaliseFilters(filters: Filters): Filters {
    const out: Filters = { ...filters }
    if (out.assigned === 'me' || out.assigned_to === 'me') out.assigned_to = this.agentId
    delete out.assigned
    return out
  }

  /** The queue a list request shows. */
  async queueFor(filters: Filters): Promise<InboxQueue> {
    const views = await this.views()

    if (filters.view !== undefined && filters.view !== null && filters.view !== '') {
      const view = views.find((v) => String(v.id) === String(filters.view))
      if (view) return this.viewQueue(view)
    }

    const selection = JSON.stringify(comparable(filters))
    if (selection !== '{}') {
      const view = views.find(
        (v) => Object.keys(v.filters).length && JSON.stringify(comparable(v.filters)) === selection
      )
      if (view) return this.viewQueue(view)
    }

    if (
      filters.assigned_to !== undefined &&
      filters.assigned_to !== null &&
      String(filters.assigned_to) === String(this.agentId)
    ) {
      return this.workspaceQueue('mine')
    }
    if (flag(filters, 'unassigned')) return this.workspaceQueue('unassigned')
    return this.workspaceQueue('all')
  }

  /** The filters the list applies: the request's, over a view picked by id. */
  listFilters(filters: Filters, queue: InboxQueue): Filters {
    if (filters.view !== undefined && queue.key.startsWith('view:')) {
      const rest = { ...filters }
      delete rest.view
      return { ...queue.filters, ...rest }
    }
    return filters
  }

  /** Remember the queue for the ticket page, which is opened from the list. */
  remember(session: any, queue: InboxQueue): void {
    session?.put?.(SESSION_KEY, queue.key)
  }

  /** The queue last shown in the list, or All tickets. */
  async recalled(session: any): Promise<InboxQueue> {
    const key = session?.get?.(SESSION_KEY)
    if (typeof key !== 'string') return this.workspaceQueue('all')
    if (key.startsWith('view:')) {
      // The view may have been deleted or unshared since.
      const views = await this.views()
      const view = views.find((v) => String(v.id) === key.slice(5))
      return view ? this.viewQueue(view) : this.workspaceQueue('all')
    }
    return this.workspaceQueue(key)
  }

  queueProp(queue: InboxQueue): { key: string; title: string } {
    return { key: queue.key, title: queue.title }
  }

  /**
   * `{ inbox }`, or nothing in cloud mode: there the tickets live in the
   * hosted service, and counting the local table would show zeroes.
   */
  async inboxProps(queue: InboxQueue): Promise<{ inbox?: InboxSummary }> {
    if (getConfig().mode === 'cloud') return {}
    return { inbox: await this.summary(queue) }
  }

  /** The `inbox` prop for this agent and queue, cached per agent and queue. */
  async summary(queue: InboxQueue): Promise<InboxSummary> {
    const seconds = Number(getConfig().agentInbox?.cacheSeconds ?? 10)
    if (!(seconds > 0)) return this.build(queue)

    const key = JSON.stringify([String(this.agentId), queue.key, comparable(queue.filters)])
    const now = Date.now()
    const hit = cache.get(key)
    if (hit && hit.expires > now) return hit.value

    const value = await this.build(queue)
    for (const [stale, entry] of cache) if (entry.expires <= now) cache.delete(stale)
    cache.set(key, { expires: now + seconds * 1000, value })
    return value
  }

  /** Built-in views, then the agent's own and shared saved views. */
  async views(): Promise<InboxView[]> {
    if (this.#views) return this.#views
    const me = this.agentId
    const builtIn: Array<[string, Filters]> = [
      ['urgent', { priority: 'urgent', open: 1 }],
      ['sla_at_risk', { sla_at_risk: 1 }],
      ['waiting_on_me', { assigned_to: me, status: 'waiting_on_agent' }],
      ['waiting_on_customer', { assigned_to: me, status: 'waiting_on_customer' }],
      ['recently_updated', { open: 1, updated_within_hours: 24, sort_by: 'updated_at' }],
    ]
    const saved = await SavedView.query()
      .withScopes((scopes) => scopes.visibleTo(me))
      .orderBy('order', 'asc')
      .orderBy('id', 'asc')
      .limit(MAX_SAVED_VIEWS)

    this.#views = [
      ...builtIn.map(([id, filters]) => ({ id, name: t(`agent_inbox.views.${id}`), filters })),
      ...saved.map((view) => ({
        id: view.id,
        name: view.name,
        filters: this.normaliseFilters(
          view.filters && typeof view.filters === 'object' && !Array.isArray(view.filters)
            ? view.filters
            : {}
        ),
      })),
    ]
    return this.#views
  }

  protected async build(queue: InboxQueue): Promise<InboxSummary> {
    const base = queue.filters
    const views = await this.views()
    const counted = []
    for (const view of views) {
      counted.push({
        id: view.id,
        name: view.name,
        count: await this.countOpen(view.filters),
        filters: view.filters,
      })
    }
    return {
      counts: {
        mine: await this.countOpen({ assigned_to: this.agentId }),
        unassigned: await this.countOpen({ unassigned: 1 }),
        all: await this.countOpen({}),
      },
      views: counted,
      // Each stat is the list the tile opens: the queue plus the tile's filters.
      stats: {
        open: await this.count({ ...base, status: 'open' }),
        urgent: await this.count({ ...base, priority: 'urgent', open: 1 }),
        sla_at_risk: await this.count({ ...base, sla_at_risk: 1 }),
        resolved_today: await this.count({ ...base, status: 'resolved', resolved_today: 1 }),
      },
    }
  }

  /** Unresolved tickets, unless the filters ask for a status themselves. */
  protected countOpen(filters: Filters): Promise<number> {
    return this.count(filters.status ? filters : { ...filters, open: 1 })
  }

  protected async count(filters: Filters): Promise<number> {
    const query = Ticket.query()
    await applyListFilters(query, filters)
    const row = await query.count('* as total').first()
    return Number((row as any)?.$extras?.total ?? 0)
  }

  protected viewQueue(view: InboxView): InboxQueue {
    return { key: `view:${view.id}`, title: view.name, filters: view.filters }
  }

  protected workspaceQueue(key: string): InboxQueue {
    if (key === 'mine') {
      return { key, title: t('agent_inbox.queues.mine'), filters: { assigned_to: this.agentId } }
    }
    if (key === 'unassigned') {
      return { key, title: t('agent_inbox.queues.unassigned'), filters: { unassigned: 1 } }
    }
    return { key: 'all', title: t('agent_inbox.queues.all'), filters: {} }
  }
}

export { BUILT_IN_VIEW_IDS }

/** Filters as strings, without empty values or order, for comparing a URL with a view. */
function comparable(filters: Filters): Record<string, string> {
  const clean: Record<string, string> = {}
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key]
    if (
      value === '' ||
      value === null ||
      value === undefined ||
      value === false ||
      PRESENTATION_KEYS.includes(key)
    ) {
      continue
    }
    clean[key] = Array.isArray(value)
      ? value.map(String).sort().join(',')
      : String(value === true ? 1 : value)
  }
  return clean
}
