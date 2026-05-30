/**
 * A host-app entity that can be attached to a ticket as its *subject* — the
 * thing the ticket is about (Project, Customer, asset, …), distinct from the
 * requester.
 */
export interface TicketSubject {
  ticketSubjectTitle(): string
  ticketSubjectSubtitle(): string | null
  ticketSubjectUrl(): string | null
  ticketSubjectColor(): string | null
  ticketSubjectIcon(): string | null
}

export type SerializedTicketSubject = {
  type: string
  id: string
  role: string | null
  title: string
  subtitle: string | null
  url: string | null
  color: string | null
  icon: string | null
  missing: boolean
}

export type TicketSubjectSyncItem =
  | { type: string; id: string; role?: string | null }
  | [type: string, id: string, role?: string | null]
