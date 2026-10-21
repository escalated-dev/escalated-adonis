import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../models/ticket.js'
import TicketLink from '../models/ticket_link.js'
import SideConversation from '../models/side_conversation.js'
import TicketMergeService from '../services/ticket_merge_service.js'
import TicketLinkService from '../services/ticket_link_service.js'
import SideConversationService from '../services/side_conversation_service.js'
import { isValidLinkType } from '../support/ticket_link_types.js'
import { isValidChannel } from '../support/side_conversation_channels.js'
import { getAuthUser } from '../support/auth_user.js'

/*
|--------------------------------------------------------------------------
| Ticket merge, links and side conversations (admin)
|--------------------------------------------------------------------------
|
| The routes the shared frontend's TicketMergeDialog, TicketLinkPanel and
| SideConversation components call, answering as escalated-laravel's
| TicketMergeController, TicketLinkController and SideConversationController:
| lists are JSON, changes redirect back with a flash message.
|
*/

function ticketSummary(ticket: Ticket | null | undefined) {
  if (!ticket) return null
  return {
    id: ticket.id,
    reference: ticket.reference,
    subject: ticket.subject,
    status: ticket.status,
    type: ticket.ticketType ?? null,
  }
}

function back(ctx: HttpContext, kind: 'success' | 'error', message: string) {
  ctx.session.flash(kind, message)
  return ctx.response.redirect().back()
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export default class AdminTicketRelationsController {
  // ---- Merge -----------------------------------------------------------------

  /** GET admin/tickets/merge-search?q= — `{tickets: [...]}`, unmerged only. */
  async mergeSearch(ctx: HttpContext) {
    const term = text(ctx.request.input('q'))
    if (!term) return ctx.response.json({ tickets: [] })
    // `!` escapes LIKE wildcards the same way on every database.
    const pattern = `%${term.replace(/[!%_]/g, (char) => `!${char}`)}%`
    const tickets = await Ticket.query()
      .whereNull('merged_into_id')
      .where((query) => {
        query
          .whereRaw("reference like ? escape '!'", [pattern])
          .orWhereRaw("subject like ? escape '!'", [pattern])
      })
      .orderBy('id', 'desc')
      .limit(10)
    return ctx.response.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        reference: ticket.reference,
        subject: ticket.subject,
        status: ticket.status,
        created_at: ticket.createdAt?.toISO() ?? null,
      })),
    })
  }

  /** POST admin/tickets/:ticket/merge — `{target_reference}`. */
  async merge(ctx: HttpContext) {
    const source = (ctx as any).escalatedTicket as Ticket
    const reference = text(ctx.request.input('target_reference'))
    if (!reference) return back(ctx, 'error', 'Choose the ticket to merge into.')

    const target = await Ticket.query()
      .where('reference', reference)
      .whereNull('merged_into_id')
      .firstOrFail()
    if (target.id === source.id) return back(ctx, 'error', 'Cannot merge a ticket into itself.')
    if (source.mergedIntoId) return back(ctx, 'error', 'This ticket was already merged.')

    await new TicketMergeService().merge(source, target, getAuthUser(ctx.auth))
    return back(ctx, 'success', `Ticket merged into ${target.reference}.`)
  }

  // ---- Links -----------------------------------------------------------------

  /** GET admin/tickets/:ticket/links — `{links: [{id, link_type, direction, ticket}]}`. */
  async links(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const links = await new TicketLinkService().forTicket(ticket.id)
    return ctx.response.json({
      links: links.map((link) => ({
        id: link.id,
        link_type: link.linkType,
        direction: link.direction,
        ticket: ticketSummary(link.ticket),
      })),
    })
  }

  /** POST admin/tickets/:ticket/links — `{target_reference, link_type}`. */
  async storeLink(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const reference = text(ctx.request.input('target_reference'))
    const linkType = text(ctx.request.input('link_type'))
    if (!reference) return back(ctx, 'error', 'Choose the ticket to link.')
    if (!isValidLinkType(linkType)) return back(ctx, 'error', 'Invalid link type.')

    const target = await Ticket.query().where('reference', reference).firstOrFail()
    try {
      await new TicketLinkService().link(ticket, target, linkType)
    } catch (error) {
      return back(ctx, 'error', (error as Error).message)
    }
    return back(ctx, 'success', 'Ticket linked successfully.')
  }

  /** DELETE admin/tickets/:ticket/links/:link — only a link touching this ticket. */
  async destroyLink(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const link = await TicketLink.query()
      .where('id', Number(ctx.params.link))
      .where((query) => {
        query.where('parent_ticket_id', ticket.id).orWhere('child_ticket_id', ticket.id)
      })
      .firstOrFail()
    await new TicketLinkService().unlink(link)
    return back(ctx, 'success', 'Ticket link removed.')
  }

  // ---- Side conversations --------------------------------------------------------

  /** GET admin/tickets/:ticket/side-conversations — `{conversations: [...]}`. */
  async sideConversations(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const conversations = await new SideConversationService().forTicket(ticket.id)
    return ctx.response.json({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        ticket_id: conversation.ticketId,
        subject: conversation.subject,
        channel: conversation.channel,
        status: conversation.status,
        created_by: conversation.createdBy,
        created_at: conversation.createdAt?.toISO() ?? null,
        replies: (conversation.replies ?? []).map((reply) => ({
          id: reply.id,
          body: reply.body,
          author_id: reply.authorId,
          created_at: reply.createdAt?.toISO() ?? null,
        })),
      })),
    })
  }

  /** POST admin/tickets/:ticket/side-conversations — `{subject, channel, body}`. */
  async storeSideConversation(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    const subject = text(ctx.request.input('subject'))
    const channel = text(ctx.request.input('channel'))
    const body = text(ctx.request.input('body'))
    if (!subject || subject.length > 255) return back(ctx, 'error', 'The subject is required.')
    if (!isValidChannel(channel)) return back(ctx, 'error', 'Invalid channel.')
    if (!body) return back(ctx, 'error', 'The body is required.')

    await new SideConversationService().create(
      ticket.id,
      subject,
      channel,
      body,
      getAuthUser(ctx.auth)?.id ?? null
    )
    return back(ctx, 'success', 'Side conversation created.')
  }

  /** POST admin/tickets/:ticket/side-conversations/:conversation/reply — `{body}`. */
  async replySideConversation(ctx: HttpContext) {
    const conversation = await this.conversation(ctx)
    const body = text(ctx.request.input('body'))
    if (!body) return back(ctx, 'error', 'The body is required.')
    await new SideConversationService().addReply(
      conversation.id,
      body,
      getAuthUser(ctx.auth)?.id ?? null
    )
    return back(ctx, 'success', 'Reply added.')
  }

  /** POST admin/tickets/:ticket/side-conversations/:conversation/close */
  async closeSideConversation(ctx: HttpContext) {
    const conversation = await this.conversation(ctx)
    await new SideConversationService().close(conversation.id)
    return back(ctx, 'success', 'Side conversation closed.')
  }

  /** The conversation named in the route, reached only through its own ticket. */
  protected async conversation(ctx: HttpContext) {
    const ticket = (ctx as any).escalatedTicket as Ticket
    return SideConversation.query()
      .where('id', Number(ctx.params.conversation))
      .where('ticket_id', ticket.id)
      .firstOrFail()
  }
}
