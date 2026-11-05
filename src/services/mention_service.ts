import { DateTime } from 'luxon'
import type Reply from '../models/reply.js'
import { staffUsers, type StaffUser } from '../support/assignable_agents.js'
import { agentCanAccessTicket } from '../support/ticket_access.js'
import { findHostUser } from '../support/user_model.js'

/** `@{Full Name}`, what the composer's mention picker inserts. */
const BRACED = /@\{([^}]+)\}/g
/** `@name`, outside braces. */
const SIMPLE = /@([a-zA-Z0-9_.-]+)(?![^{]*\})/g

export const MENTION_SUGGESTIONS_LIMIT = 10

/**
 * @mentions in replies and internal notes, as escalated-laravel's
 * MentionService: `@{Full Name}` and `@name` match a staff user (an agent or
 * admin, `authorization.isAgent` / `isAdmin`) by name or email, ignoring case.
 * Each mentioned agent who may see the ticket gets an `escalated_mentions` row
 * and a `mention` notification in the agent feed. The author is never
 * notified of their own mention.
 */
export default class MentionService {
  async processMentions(reply: Reply) {
    const mentioned = await this.mentionedAgents(reply.body)
    const agents = mentioned.filter(
      (agent) => reply.authorId === null || String(agent.id) !== String(reply.authorId)
    )
    if (agents.length === 0) return []

    const { default: db } = await import('@adonisjs/lucid/services/db')
    const mentions: Array<{ reply_id: number; user_id: number }> = []

    for (const agent of agents) {
      if (!(await agentCanAccessTicket(agent.id, { id: reply.ticketId }))) continue
      try {
        await db.table('escalated_mentions').insert({
          reply_id: reply.id,
          user_id: agent.id,
          created_at: DateTime.now().toSQL(),
        })
        mentions.push({ reply_id: reply.id, user_id: agent.id })
      } catch {
        // unique constraint violation - mention already exists
      }
    }

    await this.notifyMentionedUsers(reply, mentions)
    return mentions
  }

  /** The names mentioned in a body, braced and simple, trimmed and unique. */
  extractMentions(text: string): string[] {
    if (!text) return []
    const names = [
      ...[...text.matchAll(BRACED)].map((match) => match[1]),
      ...[...text.matchAll(SIMPLE)].map((match) => match[1]),
    ]
      .map((name) => name.trim())
      .filter((name) => name !== '')
    return [...new Set(names)]
  }

  /** The staff a body mentions, by name or email (case-insensitive). */
  async mentionedAgents(text: string): Promise<StaffUser[]> {
    const names = new Set(this.extractMentions(text).map((name) => name.toLowerCase()))
    if (names.size === 0) return []
    const staff = await staffUsers()
    return staff.filter(
      (user) =>
        (user.name !== '' && names.has(user.name.toLowerCase())) ||
        (user.email !== '' && names.has(user.email.toLowerCase()))
    )
  }

  /**
   * The mention picker (escalated-laravel's AgentSearchController): up to
   * `limit` agents and admins whose name or email contains the query.
   */
  async searchAgents(query: string, limit: number = MENTION_SUGGESTIONS_LIMIT) {
    const needle = String(query ?? '')
      .trim()
      .toLowerCase()
    if (!needle) return []
    const max = Number.isInteger(limit) && limit > 0 ? limit : MENTION_SUGGESTIONS_LIMIT
    const staff = await staffUsers()
    return staff
      .filter(
        (user) =>
          user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
      )
      .slice(0, max)
      .map((user) => ({ id: user.id, name: user.name || user.email, email: user.email }))
  }

  async unreadMentions(userId: number) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    return db
      .from('escalated_mentions')
      .join('escalated_replies', 'escalated_mentions.reply_id', 'escalated_replies.id')
      .join('escalated_tickets', 'escalated_replies.ticket_id', 'escalated_tickets.id')
      .where('escalated_mentions.user_id', userId)
      .whereNull('escalated_mentions.read_at')
      .select(
        'escalated_mentions.id',
        'escalated_mentions.reply_id',
        'escalated_tickets.id as ticket_id',
        'escalated_tickets.reference as ticket_reference',
        'escalated_tickets.subject as ticket_subject',
        'escalated_mentions.created_at'
      )
      .orderBy('escalated_mentions.created_at', 'desc')
  }

  async markAsRead(mentionIds: number[], userId: number) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    await db
      .from('escalated_mentions')
      .whereIn('id', mentionIds)
      .where('user_id', userId)
      .update({ read_at: DateTime.now().toSQL() })
  }

  private async notifyMentionedUsers(
    reply: Reply,
    mentions: Array<{ reply_id: number; user_id: number }>
  ) {
    if (mentions.length === 0) return
    const { notify } = await import('./agent_panel.js')
    const { default: Ticket } = await import('../models/ticket.js')
    const { withTicketAccess } = await import('../support/ticket_access.js')
    const ticket = await withTicketAccess(null, () => Ticket.find(reply.ticketId))
    if (!ticket) return
    const author = await findHostUser(reply.authorId ?? null).catch(() => null)
    const mentionedBy = author?.name ?? author?.fullName ?? author?.email ?? 'Someone'

    for (const mention of mentions) {
      await notify(
        mention.user_id,
        'mention',
        ticket,
        { reply_id: reply.id, mentioned_by: mentionedBy },
        reply.authorId ?? null
      )
    }
  }
}
