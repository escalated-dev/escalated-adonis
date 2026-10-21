/**
 * The shared event vocabulary (escalated-developer-context ADR 2026-10-21,
 * "One event vocabulary for webhooks and workflow triggers").
 *
 * Outbound webhooks and workflow triggers use the canonical names only. Names
 * earlier releases stored (a webhook's `events`, a workflow's `trigger_event`)
 * are read as aliases of their canonical name, and are never emitted or
 * offered in a form.
 *
 * A dependency-free leaf, so it can be imported from anywhere.
 */

export const CANONICAL_EVENTS = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.resolved',
  'ticket.closed',
  'ticket.reopened',
  'ticket.assigned',
  'ticket.unassigned',
  'ticket.escalated',
  'ticket.priority_changed',
  'ticket.department_changed',
  'reply.created',
  'note.created',
  'sla.breached',
  'sla.warning',
  'ticket.tag_added',
  'ticket.tag_removed',
  'chat.started',
  'chat.assigned',
  'chat.transferred',
  'chat.message',
  'chat.ended',
] as const

export type CanonicalEvent = (typeof CANONICAL_EVENTS)[number]

/** Legacy name → canonical name. Read, never emitted. */
export const LEGACY_EVENT_NAMES: Readonly<Record<string, CanonicalEvent>> = {
  'ticket.replied': 'reply.created',
  'internal_note.added': 'note.created',
  'internal_note.created': 'note.created',
  'tag.added': 'ticket.tag_added',
  'ticket.tagged': 'ticket.tag_added',
  'tag.removed': 'ticket.tag_removed',
  'ticket.untagged': 'ticket.tag_removed',
  'chat.session_started': 'chat.started',
  'chat.session_ended': 'chat.ended',
}

/** The canonical name for `name`; an unknown name passes through unchanged. */
export function canonicalEvent(name: string): string {
  return Object.hasOwn(LEGACY_EVENT_NAMES, name) ? LEGACY_EVENT_NAMES[name] : name
}

/** `names` read as canonical names: non-strings dropped, de-duplicated, order kept. */
export function canonicalEvents(names: unknown): string[] {
  const list = Array.isArray(names) ? names : []
  const result: string[] = []
  for (const name of list) {
    if (typeof name !== 'string') continue
    const canonical = canonicalEvent(name)
    if (!result.includes(canonical)) result.push(canonical)
  }
  return result
}

/** `name` (read as canonical) plus every legacy name that reads as it. */
export function aliasesOf(name: string): string[] {
  const canonical = canonicalEvent(name)
  return [
    canonical,
    ...Object.entries(LEGACY_EVENT_NAMES)
      .filter(([, target]) => target === canonical)
      .map(([legacy]) => legacy),
  ]
}
