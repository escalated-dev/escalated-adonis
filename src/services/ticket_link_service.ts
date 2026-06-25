import TicketLink from '../models/ticket_link.js'
import type Ticket from '../models/ticket.js'
import { isValidLinkType } from '../support/ticket_link_types.js'

export interface TicketLinkView {
  id: number
  linkType: string
  direction: 'parent' | 'child'
  ticket: Ticket | null
}

/**
 * Manages directional links between tickets. Mirrors the Laravel
 * TicketLinkController logic: a ticket cannot link to itself, and two tickets
 * cannot be linked twice with the same type in either direction.
 */
export default class TicketLinkService {
  /**
   * Link two tickets.
   *
   * @throws Error on invalid type, self-link, or duplicate.
   */
  async link(source: Ticket, target: Ticket, linkType: string): Promise<TicketLink> {
    if (!isValidLinkType(linkType)) {
      throw new Error('Invalid link type.')
    }
    if (source.id === target.id) {
      throw new Error('Cannot link a ticket to itself.')
    }
    if (await this.linkExists(source.id, target.id, linkType)) {
      throw new Error('These tickets are already linked.')
    }

    return TicketLink.create({
      parentTicketId: source.id,
      childTicketId: target.id,
      linkType,
    })
  }

  /** Whether the two tickets are already linked with this type (either way). */
  async linkExists(a: number, b: number, linkType: string): Promise<boolean> {
    const existing = await TicketLink.query()
      .where('link_type', linkType)
      .where((query) => {
        query
          .where((sub) => sub.where('parent_ticket_id', a).where('child_ticket_id', b))
          .orWhere((sub) => sub.where('parent_ticket_id', b).where('child_ticket_id', a))
      })
      .first()

    return existing !== null
  }

  async unlink(link: TicketLink): Promise<void> {
    await link.delete()
  }

  /**
   * All links touching a ticket, each tagged with its direction relative to
   * that ticket and the ticket on the other end.
   */
  async forTicket(ticketId: number): Promise<TicketLinkView[]> {
    const asParent = await TicketLink.query()
      .where('parent_ticket_id', ticketId)
      .preload('childTicket')
    const asChild = await TicketLink.query()
      .where('child_ticket_id', ticketId)
      .preload('parentTicket')

    const links: TicketLinkView[] = []

    for (const link of asParent) {
      links.push({
        id: link.id,
        linkType: link.linkType,
        direction: 'parent',
        ticket: link.childTicket ?? null,
      })
    }
    for (const link of asChild) {
      links.push({
        id: link.id,
        linkType: link.linkType,
        direction: 'child',
        ticket: link.parentTicket ?? null,
      })
    }

    return links
  }
}
