import type { TicketSubject, SerializedTicketSubject } from '../contracts/ticket_subject.js'
import type TicketSubjectLink from '../models/ticket_subject_link.js'
import type Ticket from '../models/ticket.js'
import { getConfig } from '../helpers/config.js'

export class TicketSubjectNotAllowedError extends Error {
  constructor(type: string) {
    super(`Subject type [${type}] is not an allowed ticket subject.`)
    this.name = 'TicketSubjectNotAllowedError'
  }
}

/**
 * Flatten `ticketSubjects.types` (string list or alias map) for allowlist checks.
 */
export function ticketSubjectAllowedTypes(): string[] {
  const raw = getConfig().ticketSubjects?.types
  if (!raw) {
    return []
  }
  if (Array.isArray(raw)) {
    return raw
  }
  return Object.entries(raw).flatMap(([alias, className]) => [alias, className])
}

export function assertTicketSubjectTypeAllowed(subjectType: string): void {
  const allowed = ticketSubjectAllowedTypes()
  if (allowed.length > 0 && !allowed.includes(subjectType)) {
    throw new TicketSubjectNotAllowedError(subjectType)
  }
}

export function isTicketSubjectPresentable(value: unknown): value is TicketSubject {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as TicketSubject).ticketSubjectTitle === 'function'
  )
}

export default class TicketSubjectService {
  get resolver(): ((type: string, id: string) => Promise<TicketSubject | null>) | undefined {
    return getConfig().ticketSubjects?.resolver
  }

  async serializeLinks(links: TicketSubjectLink[]): Promise<SerializedTicketSubject[]> {
    const resolver = this.resolver
    const result: SerializedTicketSubject[] = []

    for (const link of links) {
      const resolved = resolver ? await resolver(link.subjectType, link.subjectId) : null
      const presents = isTicketSubjectPresentable(resolved)

      result.push({
        type: link.subjectType,
        id: link.subjectId,
        role: link.role,
        title: presents ? resolved.ticketSubjectTitle() : `${link.subjectType}#${link.subjectId}`,
        subtitle: presents ? resolved.ticketSubjectSubtitle() : null,
        url: presents ? resolved.ticketSubjectUrl() : null,
        color: presents ? resolved.ticketSubjectColor() : null,
        icon: presents ? resolved.ticketSubjectIcon() : null,
        missing: !presents,
      })
    }

    return result
  }

  async serializeForTicket(ticket: Ticket): Promise<SerializedTicketSubject[]> {
    await ticket.load('subjects', (query) => {
      query.orderBy('position', 'asc')
    })
    return this.serializeLinks(ticket.subjects)
  }
}
