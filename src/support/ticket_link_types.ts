/**
 * Accepted ticket-to-ticket link types. Kept free of Lucid/DB imports so the
 * validator can be unit-tested in isolation. Mirrors the Laravel
 * TicketLinkController's allowed `link_type` values.
 */
export const TICKET_LINK_TYPES = ['problem_incident', 'parent_child', 'related'] as const

export type TicketLinkType = (typeof TICKET_LINK_TYPES)[number]

/** Whether a link type is one of the accepted values. */
export function isValidLinkType(linkType: string): boolean {
  return (TICKET_LINK_TYPES as readonly string[]).includes(linkType)
}
