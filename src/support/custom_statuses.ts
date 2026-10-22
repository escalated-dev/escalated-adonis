/*
|--------------------------------------------------------------------------
| Custom ticket statuses
|--------------------------------------------------------------------------
|
| A custom status belongs to one of five categories, and every lifecycle rule
| keys off the category. A ticket that takes a custom status moves to the
| category's built-in "anchor" status, so the built-in `status` column stays
| the source of truth for transitions, SLA, reports and auto-close, and
| `ticket_status_id` records which sub-status the ticket is in.
|
| The same design is shared by every Escalated port (custom statuses spec).
|
*/

import type { TicketStatus } from '../types.js'

/** The categories, in the order the admin pages list them. */
export const STATUS_CATEGORIES = ['new', 'open', 'pending', 'on_hold', 'solved'] as const

export type StatusCategory = (typeof STATUS_CATEGORIES)[number]

/** The built-in status a ticket takes when it gets a custom status of each category. */
export const CATEGORY_ANCHORS: Record<StatusCategory, TicketStatus> = {
  new: 'open',
  open: 'open',
  pending: 'waiting_on_customer',
  on_hold: 'in_progress',
  solved: 'resolved',
}

/** The category of each built-in status. */
export const BUILT_IN_CATEGORIES: Record<TicketStatus, StatusCategory> = {
  open: 'open',
  in_progress: 'open',
  waiting_on_customer: 'pending',
  waiting_on_agent: 'open',
  escalated: 'open',
  resolved: 'solved',
  closed: 'solved',
  reopened: 'open',
}

export const DEFAULT_STATUS_COLOR = '#6b7280'

export function isStatusCategory(value: unknown): value is StatusCategory {
  return typeof value === 'string' && (STATUS_CATEGORIES as readonly string[]).includes(value)
}

export function isBuiltInStatus(value: unknown): value is TicketStatus {
  return typeof value === 'string' && Object.hasOwn(BUILT_IN_CATEGORIES, value)
}

/** The category of a built-in status; `open` for anything unrecognised. */
export function builtInCategory(status: string): StatusCategory {
  return isBuiltInStatus(status) ? BUILT_IN_CATEGORIES[status] : 'open'
}

/**
 * A slug from a label, with `_` as the separator: lower case ASCII letters and
 * digits, runs of anything else collapsed into one separator.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** The summary of a custom status that agent and admin views carry. */
export type CustomStatusSummary = {
  id: number
  label: string
  slug: string
  color: string
  category: StatusCategory
}
