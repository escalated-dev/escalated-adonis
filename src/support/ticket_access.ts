import { AsyncLocalStorage } from 'node:async_hooks'
import { ModelQueryBuilder } from '@adonisjs/lucid/orm'
import { DatabaseQueryBuilder } from '@adonisjs/lucid/database'
import { getConfig } from '../helpers/config.js'

export interface TicketAccount {
  type: string
  id: string | number
}

export interface AccountReference {
  kind: 'requester' | 'subject' | 'agent'
  type: string
  id: string | number
  model?: any
}

interface Actor {
  user: any
  agent: boolean
  admin: boolean
  account: TicketAccount | null
}

const actors = new AsyncLocalStorage<Actor | null>()

export function restrictedTicketAccess(): boolean {
  const config = getConfig()
  return config.visibility === 'department' || config.accounts?.scopeAgents === true
}

export function validateTicketAccess(): void {
  const config = getConfig()
  if (config.visibility && !['all', 'department'].includes(config.visibility)) {
    throw new Error('Escalated visibility must be all or department')
  }
  if (config.accounts?.scopeAgents && (!config.accounts.enabled || !config.accounts.resolver)) {
    throw new Error('Account visibility requires accounts.enabled and accounts.resolver')
  }
  if (
    restrictedTicketAccess() &&
    (!config.authorization?.isAgent || !config.authorization?.isAdmin)
  ) {
    throw new Error('Ticket visibility requires authorization.isAgent and authorization.isAdmin')
  }
}

export function normalizeAccount(value: unknown): TicketAccount | null {
  if (!value || typeof value !== 'object') return null
  const account = value as TicketAccount
  if (
    typeof account.type !== 'string' ||
    !account.type ||
    !['string', 'number'].includes(typeof account.id) ||
    String(account.id) === ''
  )
    return null
  return { type: account.type, id: String(account.id) }
}

export async function resolveTicketAccount(
  reference: AccountReference
): Promise<TicketAccount | null> {
  const config = getConfig()
  if (!config.accounts?.enabled || !config.accounts.resolver) return null
  return normalizeAccount(await config.accounts.resolver(reference))
}

/** Scope all Lucid ticket queries in this async operation, including raw query builders. */
export async function withTicketAccess<T>(user: any, work: () => T): Promise<Awaited<T>> {
  validateTicketAccess()
  if (!user || !restrictedTicketAccess()) return await actors.run(null, async () => await work())
  const config = getConfig()
  const admin = await config.authorization.isAdmin(user)
  const agent = admin || (await config.authorization.isAgent(user))
  const account =
    agent && !admin && config.accounts?.scopeAgents
      ? await resolveTicketAccount({
          kind: 'agent',
          type: user.constructor.name,
          id: user.id,
          model: user,
        })
      : null
  return await actors.run({ user, agent, admin, account }, async () => await work())
}

/** Trusted background work only; never derive this decision from request input. */
export async function withoutTicketAccess<T>(work: () => T): Promise<Awaited<T>> {
  return await actors.run(null, async () => await work())
}

function restrictedActor(): Actor | null {
  const actor = actors.getStore()
  return actor?.agent && !actor.admin && restrictedTicketAccess() ? actor : null
}

// Use byte-sensitive comparison even on a database with a case-insensitive default.
export function whereAccount(query: any, account: TicketAccount, prefix = ''): void {
  const dialect = query.client.dialect.name
  const expression =
    dialect === 'mysql'
      ? 'BINARY ?? = BINARY ?'
      : dialect === 'postgres'
        ? '?? COLLATE "C" = ?'
        : '?? COLLATE BINARY = ?'
  query
    .whereRaw(expression, [`${prefix}account_type`, account.type])
    .whereRaw(expression, [`${prefix}account_id`, String(account.id)])
}

function ticketPredicate(query: any, actor: Actor, prefix = ''): void {
  if (getConfig().visibility === 'department') {
    query.whereIn(`${prefix}department_id`, (pivot: any) => {
      pivot
        .from('escalated_department_agent')
        .select('department_id')
        .where('agent_id', actor.user.id)
    })
  }
  if (getConfig().accounts?.scopeAgents) {
    if (actor.account) whereAccount(query, actor.account, prefix)
    else query.whereRaw('1 = 0')
  }
}

const children = new Set([
  'replies',
  'ticket_activities',
  'satisfaction_ratings',
  'side_conversations',
  'ticket_subject_links',
  'ticket_subjects',
  'chat_sessions',
  'ticket_followers',
  'ticket_links',
  'ticket_tag',
  'delayed_actions',
  'workflow_logs',
  'inbound_emails',
])

function scopeQuery(query: any, actor: Actor, table: string, alias: string): void {
  const visible = (sub: any) => {
    sub.from('escalated_tickets').select('id')
    ticketPredicate(sub, actor)
  }
  if (table === 'escalated_tickets') ticketPredicate(query, actor, `${alias}.`)
  else if (table === 'escalated_ticket_links') {
    query.whereIn(`${alias}.parent_ticket_id`, visible).whereIn(`${alias}.child_ticket_id`, visible)
  } else if (children.has(table.replace(/^escalated_/, ''))) {
    query.whereIn(`${alias}.ticket_id`, visible)
  } else if (table === 'escalated_mentions') {
    query.whereIn(`${alias}.reply_id`, (sub: any) =>
      sub.from('escalated_replies').select('id').whereIn('ticket_id', visible)
    )
  } else if (table === 'escalated_side_conversation_replies') {
    query.whereIn(`${alias}.side_conversation_id`, (sub: any) =>
      sub.from('escalated_side_conversations').select('id').whereIn('ticket_id', visible)
    )
  } else if (table === 'escalated_attachments') {
    query.where((sub: any) => {
      sub
        .where((tickets: any) =>
          tickets.where('attachable_type', 'Ticket').whereIn('attachable_id', visible)
        )
        .orWhere((replies: any) =>
          replies
            .where('attachable_type', 'Reply')
            .whereIn('attachable_id', (ids: any) =>
              ids.from('escalated_replies').select('id').whereIn('ticket_id', visible)
            )
        )
    })
  }
}

let installed = false

/** Append the predicate at SQL compilation, after caller OR conditions and on cloned counts. */
export function installTicketAccess(): void {
  if (installed) return
  installed = true
  for (const builder of [ModelQueryBuilder, DatabaseQueryBuilder]) {
    const prototype = builder.prototype as any
    const original = prototype.applyWhere
    prototype.applyWhere = function () {
      const actor = restrictedActor()
      const source = this.knexQuery._single.table
      if (!actor || typeof source !== 'string' || !source.startsWith('escalated_'))
        return original.call(this)
      const [table, alias = table] = source.split(/\s+(?:as\s+)?/i)
      const saved = this.whereStack
      // Lucid consumes the first condition of grouped stacks while compiling.
      // Copy every group so reused queries and pagination remain restricted.
      this.whereStack = saved.map((group: any[]) => [...group])
      try {
        this.wrapExisting()
        scopeQuery(this, actor, table, alias)
        return original.call(this)
      } finally {
        this.whereStack = saved
      }
    }
  }
}

export async function assertTicketAccess(ticket: { id: number }): Promise<void> {
  if (!restrictedActor()) return
  const { default: Ticket } = await import('../models/ticket.js')
  await Ticket.query().where('id', ticket.id).firstOrFail()
}

export async function userCanAccessTicket(user: any, ticket: { id: number }): Promise<boolean> {
  return withTicketAccess(user, async () => {
    const { default: Ticket } = await import('../models/ticket.js')
    if (!user) return false
    const query = Ticket.query().where('id', ticket.id)
    const authorization = getConfig().authorization
    if (!(await authorization.isAdmin(user)) && !(await authorization.isAgent(user))) {
      query.where('requester_id', user.id).where('requester_type', user.constructor.name)
    }
    return !!(await query.first())
  })
}

/** Agent candidates and notification recipients resolve through the host's own database. */
export async function ticketUser(userId: string | number): Promise<any> {
  const { default: User } = await import(getConfig().userModel || '#models/user')
  return User.find(userId)
}

export async function agentCanAccessTicket(
  userId: string | number,
  ticket: { id: number }
): Promise<boolean> {
  if (!restrictedTicketAccess()) return true
  const user = await ticketUser(userId)
  if (!user) return false
  const authorization = getConfig().authorization
  if (!(await authorization.isAdmin(user)) && !(await authorization.isAgent(user))) return false
  return userCanAccessTicket(user, ticket)
}

export function accountCondition(query: any, value: unknown, operator = 'equals'): void {
  const account = normalizeAccount(value)
  if (!account || !['equals', '=', 'not_equals', '!='].includes(operator)) {
    query.whereRaw('1 = 0')
    return
  }
  if (operator === 'not_equals' || operator === '!=') {
    query.where((group: any) =>
      group
        .whereNull('account_type')
        .orWhereNull('account_id')
        .orWhereNot((pair: any) => whereAccount(pair, account))
    )
  } else query.where((pair: any) => whereAccount(pair, account))
}
