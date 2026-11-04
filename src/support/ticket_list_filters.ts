import { DateTime } from 'luxon'
import CustomStatus from '../models/custom_status.js'
import { isBuiltInStatus } from './custom_statuses.js'
import { accountCondition } from './ticket_access.js'

/**
 * The ticket list's filters, applied to a ticket query.
 *
 * The list and the agent inbox counts both go through here, so a count and
 * the list it labels cannot disagree about what a filter means.
 */

/** How close a due SLA target has to be for the ticket to be "at risk". */
export const SLA_AT_RISK_MINUTES = 60

export const MAX_UPDATED_WITHIN_HOURS = 8760

const BOOLEAN_VALUES = ['0', '1', 'true', 'false', 'on', 'off', 'yes', 'no']
const TRUE_VALUES = ['1', 'true', 'on', 'yes']

/** `1`, `true`, `on` or `yes`, as escalated-laravel's boolean filters read. */
export function flag(filters: Record<string, any>, key: string): boolean {
  const value = filters[key]
  if (value === true || value === 1) return true
  return value !== null && value !== undefined && TRUE_VALUES.includes(String(value).toLowerCase())
}

/** Field errors for the filters added for the agent panel, or null. */
export function listFilterErrors(filters: Record<string, any>): Record<string, string[]> | null {
  const errors: Record<string, string[]> = {}
  for (const key of ['open', 'sla_at_risk', 'resolved_today']) {
    const value = filters[key]
    if (value === null || value === undefined || value === '') continue
    if (!BOOLEAN_VALUES.includes(String(value).toLowerCase())) {
      errors[key] = [`The ${key.replace(/_/g, ' ')} field must be true or false.`]
    }
  }
  const hours = filters.updated_within_hours
  if (hours !== null && hours !== undefined && hours !== '') {
    const valid = /^\d+$/.test(String(hours)) && Number(hours) >= 1
    if (!valid || Number(hours) > MAX_UPDATED_WITHIN_HOURS) {
      errors.updated_within_hours = ['The updated within hours field must be between 1 and 8760.']
    }
  }
  return Object.keys(errors).length ? errors : null
}

/** A time as the ticket table stores it, for comparing with a column. */
function sqlTime(query: any, time: DateTime): string {
  const format = query?.client?.dialect?.dateTimeFormat ?? 'yyyy-MM-dd HH:mm:ss'
  return time.toFormat(format)
}

export async function applyListFilters(
  query: any,
  filters: Record<string, any> = {},
  forUser?: { id: any; constructor: { name: string } } | null
) {
  // If listing for a specific user (customer view)
  if (forUser) {
    query.where('requester_type', forUser.constructor.name).where('requester_id', forUser.id)
  }

  if (filters.status) {
    // A custom status slug filters by the sub-status; anything else by the
    // built-in column, as before. Not for a customer's own list: custom
    // statuses are internal.
    const customerList = forUser && !filters.following
    const custom =
      isBuiltInStatus(filters.status) || customerList
        ? null
        : await CustomStatus.query()
            .where('slug', String(filters.status))
            .where('is_system', false)
            .first()
    if (custom) {
      query.where('ticket_status_id', custom.id)
    } else {
      query.where('status', filters.status)
    }
  }

  if (flag(filters, 'open')) {
    query.whereNotIn('status', ['resolved', 'closed'])
  }

  if (filters.priority) {
    query.where('priority', filters.priority)
  }

  if (filters.ticket_type) {
    query.where('ticket_type', filters.ticket_type)
  }

  if (filters.assigned_to) {
    query.where('assigned_to', filters.assigned_to)
  }

  if (filters.unassigned && filters.unassigned !== '0' && filters.unassigned !== 'false') {
    query.whereNull('assigned_to')
  }

  if (filters.account_type !== undefined || filters.account_id !== undefined) {
    accountCondition(query, { type: filters.account_type, id: filters.account_id })
  }
  if (filters.department_id) {
    query.where('department_id', filters.department_id)
  }

  if (filters.search) {
    query.where((q: any) => {
      q.where('subject', 'like', `%${filters.search}%`)
        .orWhere('reference', 'like', `%${filters.search}%`)
        .orWhere('description', 'like', `%${filters.search}%`)
    })
  }

  if (filters.sla_breached) {
    query.where((q: any) => {
      q.where('sla_first_response_breached', true).orWhere('sla_resolution_breached', true)
    })
  }

  if (flag(filters, 'sla_at_risk')) {
    const soon = sqlTime(query, DateTime.now().plus({ minutes: SLA_AT_RISK_MINUTES }))
    query.whereNotIn('status', ['resolved', 'closed']).where((q: any) => {
      q.where('sla_first_response_breached', true)
        .orWhere('sla_resolution_breached', true)
        .orWhere((r: any) => {
          r.whereNull('first_response_at').where('first_response_due_at', '<=', soon)
        })
        .orWhere('resolution_due_at', '<=', soon)
    })
  }

  if (flag(filters, 'resolved_today')) {
    query.where('resolved_at', '>=', sqlTime(query, DateTime.now().startOf('day')))
  }

  const hours = filters.updated_within_hours
  if (hours !== null && hours !== undefined && /^\d+$/.test(String(hours)) && Number(hours) > 0) {
    query.where('updated_at', '>=', sqlTime(query, DateTime.now().minus({ hours: Number(hours) })))
  }

  if (filters.tag_ids) {
    query.whereHas('tags', (q: any) => {
      q.whereIn('id', filters.tag_ids)
    })
  }

  if (filters.following && forUser) {
    const { default: lucidDb } = await import('@adonisjs/lucid/services/db')
    const followerTicketIds = await lucidDb
      .from('escalated_ticket_followers')
      .where('user_id', forUser.id)
      .select('ticket_id')
    query.whereIn(
      'id',
      followerTicketIds.map((r: any) => r.ticket_id)
    )
  }

  // Snoozed tickets are left out of staff lists unless asked for, as
  // escalated-laravel's list does. A customer's own list is unchanged.
  if (!forUser || filters.following) {
    const now = sqlTime(query, DateTime.now())
    if (flag(filters, 'snoozed')) {
      query.whereNotNull('snoozed_until').where('snoozed_until', '>', now)
    } else if (!flag(filters, 'include_snoozed')) {
      query.where((q: any) => {
        q.whereNull('snoozed_until').orWhere('snoozed_until', '<=', now)
      })
    }
  }

  return query
}
