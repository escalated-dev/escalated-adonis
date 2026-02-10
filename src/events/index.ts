/*
|--------------------------------------------------------------------------
| Escalated Events
|--------------------------------------------------------------------------
|
| All events emitted by the Escalated package. Subscribe to these events
| in your application to hook into ticket lifecycle events.
|
*/

import type Ticket from '../models/ticket.js'
import type Reply from '../models/reply.js'
import type Tag from '../models/tag.js'
import type { TicketStatus, TicketPriority } from '../types.js'

// ---- Event Data Interfaces ----

export interface TicketCreatedData {
  ticket: Ticket
}

export interface TicketUpdatedData {
  ticket: Ticket
}

export interface TicketStatusChangedData {
  ticket: Ticket
  oldStatus: TicketStatus
  newStatus: TicketStatus
  causer?: any
}

export interface TicketResolvedData {
  ticket: Ticket
  causer?: any
}

export interface TicketClosedData {
  ticket: Ticket
  causer?: any
}

export interface TicketReopenedData {
  ticket: Ticket
  causer?: any
}

export interface TicketAssignedData {
  ticket: Ticket
  agentId: number
  causer?: any
}

export interface TicketUnassignedData {
  ticket: Ticket
  previousAgentId: number | null
  causer?: any
}

export interface TicketEscalatedData {
  ticket: Ticket
  reason?: string
}

export interface TicketPriorityChangedData {
  ticket: Ticket
  oldPriority: TicketPriority
  newPriority: TicketPriority
  causer?: any
}

export interface DepartmentChangedData {
  ticket: Ticket
  oldDepartmentId: number | null
  newDepartmentId: number
  causer?: any
}

export interface ReplyCreatedData {
  reply: Reply
}

export interface InternalNoteAddedData {
  reply: Reply
}

export interface SlaBreachedData {
  ticket: Ticket
  type: 'first_response' | 'resolution'
}

export interface SlaWarningData {
  ticket: Ticket
  type: 'first_response' | 'resolution'
  minutesRemaining: number
}

export interface TagAddedToTicketData {
  ticket: Ticket
  tag: Tag
}

export interface TagRemovedFromTicketData {
  ticket: Ticket
  tag: Tag
}

// ---- Event Names ----

export const ESCALATED_EVENTS = {
  TICKET_CREATED: 'escalated:ticket:created',
  TICKET_UPDATED: 'escalated:ticket:updated',
  TICKET_STATUS_CHANGED: 'escalated:ticket:statusChanged',
  TICKET_RESOLVED: 'escalated:ticket:resolved',
  TICKET_CLOSED: 'escalated:ticket:closed',
  TICKET_REOPENED: 'escalated:ticket:reopened',
  TICKET_ASSIGNED: 'escalated:ticket:assigned',
  TICKET_UNASSIGNED: 'escalated:ticket:unassigned',
  TICKET_ESCALATED: 'escalated:ticket:escalated',
  TICKET_PRIORITY_CHANGED: 'escalated:ticket:priorityChanged',
  DEPARTMENT_CHANGED: 'escalated:ticket:departmentChanged',
  REPLY_CREATED: 'escalated:reply:created',
  INTERNAL_NOTE_ADDED: 'escalated:reply:noteAdded',
  SLA_BREACHED: 'escalated:sla:breached',
  SLA_WARNING: 'escalated:sla:warning',
  TAG_ADDED: 'escalated:tag:added',
  TAG_REMOVED: 'escalated:tag:removed',
} as const

// ---- Event type map for Adonis Emitter ----

export interface EscalatedEventsList {
  [ESCALATED_EVENTS.TICKET_CREATED]: TicketCreatedData
  [ESCALATED_EVENTS.TICKET_UPDATED]: TicketUpdatedData
  [ESCALATED_EVENTS.TICKET_STATUS_CHANGED]: TicketStatusChangedData
  [ESCALATED_EVENTS.TICKET_RESOLVED]: TicketResolvedData
  [ESCALATED_EVENTS.TICKET_CLOSED]: TicketClosedData
  [ESCALATED_EVENTS.TICKET_REOPENED]: TicketReopenedData
  [ESCALATED_EVENTS.TICKET_ASSIGNED]: TicketAssignedData
  [ESCALATED_EVENTS.TICKET_UNASSIGNED]: TicketUnassignedData
  [ESCALATED_EVENTS.TICKET_ESCALATED]: TicketEscalatedData
  [ESCALATED_EVENTS.TICKET_PRIORITY_CHANGED]: TicketPriorityChangedData
  [ESCALATED_EVENTS.DEPARTMENT_CHANGED]: DepartmentChangedData
  [ESCALATED_EVENTS.REPLY_CREATED]: ReplyCreatedData
  [ESCALATED_EVENTS.INTERNAL_NOTE_ADDED]: InternalNoteAddedData
  [ESCALATED_EVENTS.SLA_BREACHED]: SlaBreachedData
  [ESCALATED_EVENTS.SLA_WARNING]: SlaWarningData
  [ESCALATED_EVENTS.TAG_ADDED]: TagAddedToTicketData
  [ESCALATED_EVENTS.TAG_REMOVED]: TagRemovedFromTicketData
}
