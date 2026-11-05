/*
|--------------------------------------------------------------------------
| The agent panel's data (ADR 2026-11-05-agent-panel-data)
|--------------------------------------------------------------------------
|
| Per-agent unread markers, customer online status, the agent's own status
| and the agents' in-app notifications feed. escalated-laravel is the
| reference implementation.
|
*/

import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { getConfig } from '../helpers/config.js'
import type { UserId } from '../helpers/user_id_column.js'
import ImportContext from '../support/import_context.js'
import { findHostUser } from '../support/user_model.js'
import { withTicketAccess } from '../support/ticket_access.js'

export const AGENT_STATUSES = ['online', 'away', 'offline'] as const
export type AgentStatusValue = (typeof AGENT_STATUSES)[number]
export const PRESENCE_THROTTLE_SECONDS = 30
export const NOTIFICATIONS_PER_PAGE = 20
export const NOTIFICATIONS_MAX_PER_PAGE = 50
export const NOTIFICATION_TYPES = [
  'ticket_assigned',
  'ticket_reply',
  'mention',
  'sla_warning',
  'sla_breached',
  'chat_transferred',
] as const

const CUSTOMER_TYPES = ['reply', 'chat_message']
/** Reply metadata keys that mark a reply written by the system, not a person. */
const SYSTEM_MARKERS = ['workflow_id', 'automation_id', 'system_note']

function present(id: unknown): boolean {
  return id !== null && id !== undefined && id !== '' && String(id) !== '0'
}

/**
 * A timestamp as Lucid writes `@column.dateTime` values on this connection
 * (the dialect's format, the DateTime's own zone), so raw updates compare
 * correctly with model writes on every database.
 */
function sqlTime(value: DateTime, model: any): string {
  const format = (model.query() as any).client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
  return value.toFormat(format)
}

export async function isStaff(user: any): Promise<boolean> {
  if (!user) return false
  const authorization = getConfig().authorization
  if (!authorization) return false
  return Boolean((await authorization.isAgent(user)) || (await authorization.isAdmin(user)))
}

// ---- 1. Unread tracking ----------------------------------------------------

export async function markRead(agentId: UserId, ticketId: number): Promise<void> {
  await writeMarker(agentId, ticketId, DateTime.now())
}

export async function markUnread(agentId: UserId, ticketId: number): Promise<void> {
  await writeMarker(agentId, ticketId, null)
}

async function writeMarker(agentId: UserId, ticketId: number, at: DateTime | null) {
  const { default: TicketRead } = await import('../models/ticket_read.js')
  const existing = await TicketRead.query()
    .where('user_id', agentId)
    .where('ticket_id', ticketId)
    .first()
  if (existing) {
    existing.lastReadAt = at
    await existing.save()
    return
  }
  try {
    await TicketRead.create({ userId: agentId, ticketId, lastReadAt: at })
  } catch {
    // Another request created the marker first.
    await TicketRead.query()
      .where('user_id', agentId)
      .where('ticket_id', ticketId)
      .update({ last_read_at: at ? sqlTime(at, TicketRead) : null })
  }
}

export function isUnread(
  activity: DateTime | null | undefined,
  hasMarker: boolean,
  lastReadAt: DateTime | null | undefined
): boolean {
  if (hasMarker && !lastReadAt) return true
  if (!activity) return false
  if (!hasMarker) return true
  return activity.toMillis() > lastReadAt!.toMillis()
}

/** `{ ticketId: isUnread }` for the tickets, from one query. */
export async function unreadFlags(
  agentId: UserId,
  tickets: Array<{ id: number; lastCustomerActivityAt?: DateTime | null }>
): Promise<Map<number, boolean>> {
  const { default: TicketRead } = await import('../models/ticket_read.js')
  const markers = new Map<number, DateTime | null>()
  if (tickets.length) {
    const rows = await TicketRead.query()
      .where('user_id', agentId)
      .whereIn(
        'ticket_id',
        tickets.map((t) => t.id)
      )
    for (const row of rows) markers.set(row.ticketId, row.lastReadAt)
  }
  const flags = new Map<number, boolean>()
  for (const ticket of tickets) {
    flags.set(
      ticket.id,
      isUnread(ticket.lastCustomerActivityAt, markers.has(ticket.id), markers.get(ticket.id))
    )
  }
  return flags
}

/** Limit a ticket query to the tickets unread for the agent (two EXISTS subqueries). */
export function onlyUnread(query: any, agentId: UserId): any {
  const marker =
    'SELECT 1 FROM escalated_ticket_reads tr WHERE tr.ticket_id = escalated_tickets.id AND tr.user_id = ?'
  return query.whereRaw(
    `(EXISTS (${marker} AND tr.last_read_at IS NULL) OR (escalated_tickets.last_customer_activity_at IS NOT NULL AND NOT EXISTS (${marker} AND tr.last_read_at >= escalated_tickets.last_customer_activity_at)))`,
    [agentId, agentId]
  )
}

/**
 * A public reply or chat message from the requester, a contact, a guest (no
 * author) or a host user who is not staff. Agents' replies, notes and replies
 * a workflow, automation or the system wrote are not.
 */
export async function isCustomerSide(reply: any, ticket?: any): Promise<boolean> {
  if (reply.isInternalNote || !CUSTOMER_TYPES.includes(reply.type ?? 'reply')) return false
  const metadata = reply.metadata && typeof reply.metadata === 'object' ? reply.metadata : {}
  if (SYSTEM_MARKERS.some((key) => key in metadata)) return false
  if (!reply.authorType || !present(reply.authorId)) return true
  if (['Guest', 'Contact'].includes(reply.authorType)) return true
  if (
    ticket &&
    ticket.requesterType === reply.authorType &&
    String(ticket.requesterId) === String(reply.authorId)
  ) {
    return true
  }
  const author = await findHostUser(reply.authorId)
  return author ? !(await isStaff(author)) : false
}

/**
 * A customer-side public reply is unread activity for agents. Runs inside the
 * reply's transaction when it has one (a pool of one connection would
 * otherwise wait on itself).
 */
export async function recordReplyActivity(reply: any): Promise<void> {
  if (ImportContext.isImporting()) return
  try {
    const { default: Ticket } = await import('../models/ticket.js')
    const options = reply.$trx ? { client: reply.$trx } : undefined
    const ticket = await withTicketAccess(null, () => Ticket.find(reply.ticketId, options))
    if (!ticket || !(await isCustomerSide(reply, ticket))) return
    await withTicketAccess(null, () =>
      Ticket.query(options)
        .where('id', reply.ticketId)
        .update({
          last_customer_activity_at: sqlTime(reply.createdAt ?? DateTime.now(), Ticket),
        })
    )
  } catch (error) {
    console.warn('[Escalated] recording customer activity failed:', (error as Error).message)
  }
}

// ---- 2. Customer presence ----------------------------------------------------

export function presenceWindow(): number {
  const configured = Number(
    getConfig().presence?.onlineWindowSeconds ?? process.env.ESCALATED_PRESENCE_ONLINE_WINDOW
  )
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : 120
}

/** A ticket's customer: its requester, its contact for a guest, else the ticket itself. */
export function presenceSubject(ticket: any): [string, string] | null {
  if (ticket.requesterType && present(ticket.requesterId)) {
    return [ticket.requesterType, String(ticket.requesterId)]
  }
  if (present(ticket.contactId)) return ['Contact', String(ticket.contactId)]
  if (present(ticket.id)) return ['Ticket', String(ticket.id)]
  return null
}

/** A signed-in customer-portal user. Staff browsing the portal are not customers. */
export async function seeUser(user: any): Promise<void> {
  if (!user || !present(user.id) || (await isStaff(user))) return
  await see([user.constructor?.name ?? 'User', String(user.id)])
}

export async function seeTicketCustomer(ticket: any): Promise<void> {
  const subject = ticket ? presenceSubject(ticket) : null
  if (subject) await see(subject)
}

/** Presence is a hint: it never fails the request it rides on. */
export async function quietly(work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch (error) {
    console.warn('[Escalated] customer presence was not recorded:', (error as Error).message)
  }
}

/** Throttled in the database: a row is written only when its last write is 30 seconds old. */
async function see([type, id]: [string, string]): Promise<void> {
  const { default: CustomerPresence } = await import('../models/customer_presence.js')
  const now = DateTime.now()
  const updated = await CustomerPresence.query()
    .where('subject_type', type)
    .where('subject_id', id)
    .where(
      'last_seen_at',
      '<=',
      sqlTime(now.minus({ seconds: PRESENCE_THROTTLE_SECONDS }), CustomerPresence)
    )
    .update({
      last_seen_at: sqlTime(now, CustomerPresence),
      updated_at: sqlTime(now, CustomerPresence),
    })
  if (Number(Array.isArray(updated) ? updated[0] : updated) > 0) return
  if (await CustomerPresence.query().where('subject_type', type).where('subject_id', id).first()) {
    return
  }
  try {
    await CustomerPresence.create({ subjectType: type, subjectId: id, lastSeenAt: now })
  } catch {
    // Another request recorded them first.
  }
}

/** `requester_online` and `requester_last_seen_at` per ticket, from one query. Staff pages only. */
export async function presenceLookup(
  tickets: any[]
): Promise<Map<number, { requester_online: boolean; requester_last_seen_at: string | null }>> {
  const { default: CustomerPresence } = await import('../models/customer_presence.js')
  const subjects = new Map<string, [string, string]>()
  for (const ticket of tickets) {
    const subject = presenceSubject(ticket)
    if (subject) subjects.set(subject.join('|'), subject)
  }
  const seen = new Map<string, DateTime>()
  if (subjects.size) {
    const rows = await CustomerPresence.query().where((query) => {
      for (const [type, id] of subjects.values()) {
        query.orWhere((sub) => sub.where('subject_type', type).where('subject_id', id))
      }
    })
    for (const row of rows) seen.set(`${row.subjectType}|${row.subjectId}`, row.lastSeenAt)
  }
  const since = DateTime.now().minus({ seconds: presenceWindow() })
  const result = new Map<
    number,
    { requester_online: boolean; requester_last_seen_at: string | null }
  >()
  for (const ticket of tickets) {
    const subject = presenceSubject(ticket)
    const last = subject ? seen.get(subject.join('|')) : undefined
    result.set(ticket.id, {
      requester_online: !!last && last.toMillis() >= since.toMillis(),
      requester_last_seen_at: last ? last.toUTC().toISO() : null,
    })
  }
  return result
}

/** Puts `is_unread` and presence on agent rows (Ticket computed props), one query each. */
export async function decorate(agentId: UserId, tickets: any[], unread = true): Promise<void> {
  if (!tickets.length || getConfig().mode === 'cloud') return
  const flags = unread ? await unreadFlags(agentId, tickets) : null
  const presence = await presenceLookup(tickets)
  for (const ticket of tickets) {
    ticket.$agentPanel = {
      ...(flags ? { is_unread: flags.get(ticket.id) ?? false } : {}),
      ...presence.get(ticket.id)!,
    }
  }
}

// ---- 3. The agent's own status -------------------------------------------------

export async function agentStatus(userId: UserId): Promise<AgentStatusValue> {
  const { default: AgentProfile } = await import('../models/agent_profile.js')
  const profile = await AgentProfile.query().where('user_id', userId).first()
  const value = profile?.chatStatus as string | undefined
  return (AGENT_STATUSES as readonly string[]).includes(value ?? '')
    ? (value as AgentStatusValue)
    : 'offline'
}

/** The agent profile's chat_status, the field live-chat routing reads. */
export async function setAgentStatus(userId: UserId, status: AgentStatusValue): Promise<void> {
  const { default: AgentProfile } = await import('../models/agent_profile.js')
  const profile = await AgentProfile.query().where('user_id', userId).first()
  if (profile) {
    profile.chatStatus = status as any
    profile.lastSeenAt = DateTime.now()
    await profile.save()
    return
  }
  await AgentProfile.create({ userId, chatStatus: status as any, lastSeenAt: DateTime.now() })
}

// ---- 4. Notifications -------------------------------------------------------------

export function notificationsAvailable(): boolean {
  return getConfig().agentNotifications !== false
}

export async function notify(
  agentId: UserId | null | undefined,
  type: string,
  ticket: { id: number; reference?: string | null } | null,
  data: Record<string, unknown> = {},
  causerId: UserId | null = null
): Promise<void> {
  if (!notificationsAvailable() || !present(agentId) || ImportContext.isImporting()) return
  if (present(causerId) && String(causerId) === String(agentId)) return
  const { default: AgentNotification } = await import('../models/agent_notification.js')
  const row = await AgentNotification.create({
    id: randomUUID(),
    userId: agentId!,
    type,
    data: { ...data, ticket_id: ticket?.id ?? null, reference: ticket?.reference ?? null },
    readAt: null,
    createdAt: DateTime.now(),
  })
  await broadcastNotification(agentId!, row).catch((error) =>
    console.warn('[Escalated] notification broadcast failed:', (error as Error).message)
  )
}

/**
 * `notification.created` on the agent's private channel while broadcasting
 * is on, with the feed item as that agent sees it (redacted when they can no
 * longer view the ticket).
 */
async function broadcastNotification(agentId: UserId, row: any): Promise<void> {
  const { configuredBroadcastService } = await import('./broadcast_service.js')
  const broadcaster = configuredBroadcastService()
  if (!broadcaster) return
  const agent = await findHostUser(agentId)
  const [item] = await presentNotifications([row], agent ?? { id: agentId })
  await broadcaster.broadcastAgentNotification(agentId, item)
}

export async function unreadCount(userId: UserId): Promise<number> {
  const { default: AgentNotification } = await import('../models/agent_notification.js')
  const row = await AgentNotification.query()
    .where('user_id', userId)
    .whereNull('read_at')
    .count('* as total')
    .first()
  return Number((row as any)?.$extras?.total ?? 0)
}

const TITLES: Record<string, (reference: string, data: Record<string, any>) => string> = {
  ticket_assigned: (r) => `${r} was assigned to you`,
  ticket_reply: (r) => `New reply on ${r}`,
  mention: (r, d) => `${d.mentioned_by ?? 'Someone'} mentioned you on ${r}`,
  sla_warning: (r) => `SLA due soon on ${r}`,
  sla_breached: (r) => `SLA breached on ${r}`,
  chat_transferred: (r) => `A chat was transferred to you (${r})`,
}

/** Feed items for `user`; a ticket they can no longer see redacts the item. */
export async function presentNotifications(rows: any[], user: any): Promise<Record<string, any>[]> {
  const { default: Ticket } = await import('../models/ticket.js')
  const ids = [
    ...new Set(
      rows.map((row) => Number(row.data?.ticket_id)).filter((id) => Number.isInteger(id) && id > 0)
    ),
  ]
  const tickets = new Map<number, any>()
  if (ids.length) {
    const visible = await withTicketAccess(user, () => Ticket.query().whereIn('id', ids))
    for (const ticket of visible) tickets.set(ticket.id, ticket)
  }
  return rows.map((row) => notificationItem(row, tickets))
}

export function notificationItem(row: any, tickets: Map<number, any>): Record<string, any> {
  const data = row.data ?? {}
  const ticketId =
    data.ticket_id === null || data.ticket_id === undefined ? null : Number(data.ticket_id)
  const ticket = ticketId !== null ? (tickets.get(ticketId) ?? null) : null
  const base = {
    id: String(row.id),
    type: row.type,
    created_at: row.createdAt ? row.createdAt.toUTC().toISO() : null,
    read_at: row.readAt ? row.readAt.toUTC().toISO() : null,
  }
  if (ticketId !== null && !ticket) {
    return {
      ...base,
      title: 'A ticket you can no longer view',
      body: null,
      ticket: null,
      url: null,
    }
  }
  const reference = ticket?.reference ?? String(data.reference ?? '')
  const title = (TITLES[row.type] ?? ((r: string) => `Update on ${r}`))(reference, data)
  const prefix = getConfig().routes?.prefix ?? 'support'
  return {
    ...base,
    title,
    body: ticket?.subject ?? null,
    ticket: ticket ? { id: ticket.id, reference: ticket.reference, subject: ticket.subject } : null,
    url: ticket ? `/${prefix}/agent/tickets/${encodeURIComponent(ticket.reference)}` : null,
  }
}

// ---- Event wiring ---------------------------------------------------------------------

/**
 * @mentions in an agent's reply or internal note (escalated-laravel's
 * MentionService). A customer's reply mentions nobody; imports are skipped.
 */
async function processMentions(reply: any): Promise<void> {
  if (ImportContext.isImporting() || !reply?.body) return
  const { default: MentionService } = await import('./mention_service.js')
  await new MentionService().processMentions(reply)
}

/** Subscribes the notifications to the package events. The agent who caused an event is never notified. */
export function wireAgentNotifications(emitter: any, events: Record<string, string>): void {
  // After the emitting change: an event raised inside a transaction must not
  // wait on a connection that transaction holds.
  const safely = (work: () => Promise<void>) => {
    setImmediate(() => {
      work().catch((error) =>
        console.warn('[Escalated] agent notification failed:', (error as Error).message)
      )
    })
  }

  emitter.on(events.TICKET_ASSIGNED, (data: any) =>
    safely(() => notify(data.agentId, 'ticket_assigned', data.ticket, {}, data.causer?.id ?? null))
  )

  emitter.on(events.REPLY_CREATED, (data: any) =>
    safely(async () => {
      const reply = data.reply
      if (!reply) return
      const { default: Ticket } = await import('../models/ticket.js')
      const ticket = await withTicketAccess(null, () => Ticket.find(reply.ticketId))
      if (!ticket) return
      if (!(await isCustomerSide(reply, ticket))) {
        await processMentions(reply)
        return
      }
      const recipients = new Map<string, UserId>()
      for (const id of [ticket.assignedTo, ...(data.followerUserIds ?? [])]) {
        if (present(id)) recipients.set(String(id), id)
      }
      for (const agentId of recipients.values()) {
        await notify(agentId, 'ticket_reply', ticket, {}, reply.authorId ?? null)
      }
    })
  )

  emitter.on(events.INTERNAL_NOTE_ADDED, (data: any) =>
    safely(async () => {
      if (data.reply) await processMentions(data.reply)
    })
  )

  emitter.on(events.SLA_WARNING, (data: any) =>
    safely(() =>
      notify(data.ticket?.assignedTo, 'sla_warning', data.ticket, {
        sla_type: data.type,
        minutes_remaining: data.minutesRemaining,
      })
    )
  )

  emitter.on(events.SLA_BREACHED, (data: any) =>
    safely(() =>
      notify(data.ticket?.assignedTo, 'sla_breached', data.ticket, { sla_type: data.type })
    )
  )

  emitter.on(events.CHAT_TRANSFERRED, (data: any) =>
    safely(() =>
      notify(
        data.toAgentId,
        'chat_transferred',
        data.ticket,
        { session_id: data.sessionId ?? null },
        data.fromAgentId ?? null
      )
    )
  )
}
