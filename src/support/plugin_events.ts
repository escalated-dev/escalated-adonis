/*
|--------------------------------------------------------------------------
| Plugin events
|--------------------------------------------------------------------------
|
| The canonical events (decisions/2026-10-21-event-vocabulary.md) as plugins'
| actions see them (domain-model/plugin-contract.md): delivered under the
| canonical name only, with the subject flat at the top and again under its
| own key, snake_case.
|
*/

import { CANONICAL_EVENTS, LEGACY_EVENT_NAMES } from './event_names.js'

/**
 * The URL-safe slug the RouteRegistrar mounts a plugin under:
 * "@escalated-dev/plugin-slack" is "escalated-dev--plugin-slack".
 */
export function pluginSlug(name: string): string {
  return name
    .replace(/^@/, '')
    .replace(/\//g, '--')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toLowerCase()
}

/** Lifecycle actions the host fires itself. A plugin may not emit them. */
export const LIFECYCLE_ACTIONS = ['plugin.activated', 'plugin.deactivated', 'plugin.uninstalling']

/** Whether a plugin-emitted hook would impersonate a host event. */
export function isReservedHook(hook: string): boolean {
  return (
    LIFECYCLE_ACTIONS.includes(hook) ||
    (CANONICAL_EVENTS as readonly string[]).includes(hook) ||
    Object.prototype.hasOwnProperty.call(LEGACY_EVENT_NAMES, hook)
  )
}

function iso(value: any): string | null {
  if (value === null || value === undefined) return null
  if (typeof value?.toISO === 'function') return value.toISO()
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function pluginTicket(ticket: any): Record<string, unknown> {
  return {
    id: ticket?.id ?? null,
    reference: ticket?.reference ?? null,
    subject: ticket?.subject ?? null,
    title: ticket?.subject ?? null,
    description: ticket?.description ?? null,
    status: ticket?.status ?? null,
    priority: ticket?.priority ?? null,
    channel: ticket?.channel ?? null,
    ticket_type: ticket?.ticketType ?? null,
    department_id: ticket?.departmentId ?? null,
    assigned_to: ticket?.assignedTo ?? null,
    requester_id: ticket?.requesterId ?? null,
    contact_id: ticket?.contactId ?? null,
    metadata: ticket?.metadata ?? null,
    created_at: iso(ticket?.createdAt),
    updated_at: iso(ticket?.updatedAt),
  }
}

export function pluginReply(reply: any): Record<string, unknown> {
  return {
    id: reply?.id ?? null,
    ticket_id: reply?.ticketId ?? null,
    body: reply?.body ?? null,
    type: reply?.type ?? null,
    is_internal: reply?.isInternalNote === true,
    author_id: reply?.authorId ?? null,
    created_at: iso(reply?.createdAt),
    updated_at: iso(reply?.updatedAt),
  }
}

function withTicket(ticket: any, extra: Record<string, unknown> = {}) {
  const flat = pluginTicket(ticket)
  return { ...flat, ticket: flat, ...extra }
}

async function loadTicket(id: unknown) {
  if (id === null || id === undefined) return null
  const { default: Ticket } = await import('../models/ticket.js')
  return Ticket.find(id as any)
}

/**
 * The action payload for canonical event `name`, from the data the package
 * emits on its emitter. Null when there is nothing to deliver.
 */
export async function pluginEventPayload(
  name: string,
  data: any
): Promise<Record<string, unknown> | null> {
  if (name.startsWith('chat.')) {
    // Never the visitor's token or email.
    const ticket = data?.ticket ?? (await loadTicket(data?.ticketId))
    const session: Record<string, unknown> = {
      session_id: data?.sessionId ?? null,
      ticket_id: ticket?.id ?? data?.ticketId ?? null,
      status: null,
      agent_id: data?.agentId ?? ticket?.assignedTo ?? null,
      department_id: ticket?.departmentId ?? null,
    }
    if (name === 'chat.transferred') {
      Object.assign(session, {
        from_agent_id: data?.fromAgentId ?? null,
        to_agent_id: data?.toAgentId ?? null,
        to_department_id: data?.toDepartmentId ?? null,
      })
    }
    if (name === 'chat.message') {
      Object.assign(session, {
        reply_id: data?.replyId ?? null,
        author_type: data?.authorType ?? null,
      })
    }
    return { session }
  }

  if (name === 'reply.created' || name === 'note.created') {
    const reply = data?.reply
    if (!reply) return null
    const flat = pluginReply(reply)
    const ticket = await loadTicket(reply.ticketId)
    return { ...flat, reply: flat, ticket: ticket ? pluginTicket(ticket) : null }
  }

  if (!data?.ticket) return null

  switch (name) {
    case 'ticket.status_changed':
      return withTicket(data.ticket, {
        old_status: data.oldStatus ?? null,
        new_status: data.newStatus ?? null,
      })
    case 'ticket.assigned':
      return withTicket(data.ticket, { agent_id: data.agentId ?? null })
    case 'ticket.unassigned':
      return withTicket(data.ticket, { previous_agent_id: data.previousAgentId ?? null })
    case 'ticket.priority_changed':
      return withTicket(data.ticket, {
        old_priority: data.oldPriority ?? null,
        new_priority: data.newPriority ?? null,
      })
    case 'ticket.department_changed':
      return withTicket(data.ticket, {
        old_department_id: data.oldDepartmentId ?? null,
        new_department_id: data.newDepartmentId ?? null,
      })
    case 'ticket.tag_added':
    case 'ticket.tag_removed':
      return withTicket(data.ticket, {
        tag: data.tag
          ? { id: data.tag.id, name: data.tag.name, slug: data.tag.slug ?? null }
          : null,
      })
    case 'ticket.escalated':
      return withTicket(data.ticket, { reason: data.reason ?? null })
    case 'sla.warning':
      return withTicket(data.ticket, {
        type: data.type ?? null,
        minutes_remaining: data.minutesRemaining ?? null,
      })
    case 'sla.breached':
      return withTicket(data.ticket, { type: data.type ?? null })
    default:
      return withTicket(data.ticket)
  }
}
