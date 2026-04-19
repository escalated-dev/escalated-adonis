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

export interface ChatStartedData {
  ticket: Ticket
  sessionId: number
}

export interface ChatEndedData {
  ticket: Ticket
  sessionId: number
}

export interface ChatMessageData {
  ticketId: number
  sessionId: number
  authorType: string | null
  authorId: number | null
  body: string
}

export interface ChatTransferredData {
  ticket: Ticket
  sessionId: number
  fromAgentId: number | null
  toAgentId: number
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
  CHAT_STARTED: 'escalated:chat:started',
  CHAT_ENDED: 'escalated:chat:ended',
  CHAT_MESSAGE: 'escalated:chat:message',
  CHAT_TRANSFERRED: 'escalated:chat:transferred',
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
  [ESCALATED_EVENTS.CHAT_STARTED]: ChatStartedData
  [ESCALATED_EVENTS.CHAT_ENDED]: ChatEndedData
  [ESCALATED_EVENTS.CHAT_MESSAGE]: ChatMessageData
  [ESCALATED_EVENTS.CHAT_TRANSFERRED]: ChatTransferredData
}

/*
|--------------------------------------------------------------------------
| Module augmentation for @adonisjs/core EventsList
|--------------------------------------------------------------------------
|
| Adonis 6's emitter is strongly typed against the EventsList interface,
| and any string event name not present in EventsList is rejected at
| compile time with TS2769 ("not assignable to keyof EventsList").
|
| Importing this file (or anything that re-exports from it) registers all
| escalated:* events with the host application's emitter. Consumers do not
| need to repeat the augmentation in their own code.
|
*/
declare module '@adonisjs/core/types' {
  interface EventsList {
    'escalated:ticket:created': TicketCreatedData
    'escalated:ticket:updated': TicketUpdatedData
    'escalated:ticket:statusChanged': TicketStatusChangedData
    'escalated:ticket:resolved': TicketResolvedData
    'escalated:ticket:closed': TicketClosedData
    'escalated:ticket:reopened': TicketReopenedData
    'escalated:ticket:assigned': TicketAssignedData
    'escalated:ticket:unassigned': TicketUnassignedData
    'escalated:ticket:escalated': TicketEscalatedData
    'escalated:ticket:priorityChanged': TicketPriorityChangedData
    'escalated:ticket:departmentChanged': DepartmentChangedData
    'escalated:reply:created': ReplyCreatedData
    'escalated:reply:noteAdded': InternalNoteAddedData
    'escalated:sla:breached': SlaBreachedData
    'escalated:sla:warning': SlaWarningData
    'escalated:tag:added': TagAddedToTicketData
    'escalated:tag:removed': TagRemovedFromTicketData
    'escalated:chat:started': ChatStartedData
    'escalated:chat:ended': ChatEndedData
    'escalated:chat:message': ChatMessageData
    'escalated:chat:transferred': ChatTransferredData
  }
}
