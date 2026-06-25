import SideConversation from '../models/side_conversation.js'
import SideConversationReply from '../models/side_conversation_reply.js'
import { isValidChannel } from '../support/side_conversation_channels.js'
import type { UserId } from '../helpers/user_id_column.js'

/**
 * Manages side conversations (private internal/email threads on a ticket).
 * Mirrors the Laravel SideConversationController: creating a conversation
 * opens it with a first reply, replies can be appended, and a conversation
 * can be closed.
 */
export default class SideConversationService {
  /**
   * Open a new side conversation on a ticket with its first reply.
   *
   * @throws Error on empty subject/body or invalid channel.
   */
  async create(
    ticketId: number,
    subject: string,
    channel: string,
    body: string,
    createdBy: UserId | null = null
  ): Promise<SideConversation> {
    subject = subject.trim()
    body = body.trim()

    if (!subject) {
      throw new Error('Subject is required.')
    }
    if (!isValidChannel(channel)) {
      throw new Error('Invalid channel.')
    }
    if (!body) {
      throw new Error('Body is required.')
    }

    const conversation = await SideConversation.create({
      ticketId,
      subject,
      channel,
      status: SideConversation.STATUS_OPEN,
      createdBy,
    })

    await SideConversationReply.create({
      sideConversationId: conversation.id,
      body,
      authorId: createdBy,
    })

    return conversation
  }

  /**
   * Append a reply to a conversation.
   *
   * @throws Error on empty body.
   */
  async addReply(
    conversationId: number,
    body: string,
    authorId: UserId | null = null
  ): Promise<SideConversationReply> {
    body = body.trim()
    if (!body) {
      throw new Error('Body is required.')
    }

    return SideConversationReply.create({
      sideConversationId: conversationId,
      body,
      authorId,
    })
  }

  /** Close a side conversation. */
  async close(conversationId: number): Promise<void> {
    const conversation = await SideConversation.find(conversationId)
    if (conversation) {
      conversation.status = SideConversation.STATUS_CLOSED
      await conversation.save()
    }
  }

  /** All side conversations for a ticket (newest first), with replies loaded. */
  async forTicket(ticketId: number): Promise<SideConversation[]> {
    return SideConversation.query()
      .where('ticket_id', ticketId)
      .preload('replies', (query) => query.orderBy('created_at', 'asc'))
      .orderBy('created_at', 'desc')
  }
}
