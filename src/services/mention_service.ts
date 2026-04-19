import { DateTime } from 'luxon'
import type Reply from '../models/reply.js'
import TicketActivity from '../models/ticket_activity.js'

const MENTION_REGEX = /@(\w+(?:\.\w+)*)/g

export default class MentionService {
  async processMentions(reply: Reply) {
    const usernames = this.extractMentions(reply.body)
    if (usernames.length === 0) return []

    const { default: db } = await import('@adonisjs/lucid/services/db')
    const users = await this.findUsers(usernames)
    const mentions = []

    for (const user of users) {
      try {
        await db.table('escalated_mentions').insert({
          reply_id: reply.id,
          user_id: user.id,
          created_at: DateTime.now().toSQL(),
        })
        mentions.push({ reply_id: reply.id, user_id: user.id })
      } catch {
        // unique constraint violation - mention already exists
      }
    }

    await this.notifyMentionedUsers(reply, mentions)
    return mentions
  }

  extractMentions(text: string): string[] {
    if (!text) return []
    const matches = text.matchAll(MENTION_REGEX)
    const usernames = new Set<string>()
    for (const match of matches) {
      usernames.add(match[1])
    }
    return [...usernames]
  }

  async searchAgents(query: string, limit: number = 10) {
    if (!query) return []
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const users = await db
      .from('users')
      .where('email', 'like', `%${query}%`)
      .orWhere('name', 'like', `%${query}%`)
      .limit(limit)
    return users.map((u: any) => ({
      id: u.id,
      name: u.name || u.email,
      email: u.email,
      username: u.username || u.email.split('@')[0],
    }))
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

  private async findUsers(usernames: string[]) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const users = []
    for (const username of usernames) {
      const user = await db
        .from('users')
        .where('username', username)
        .orWhere('email', 'like', `${username}@%`)
        .first()
      if (user) users.push(user)
    }
    return users
  }

  private async notifyMentionedUsers(
    reply: Reply,
    mentions: Array<{ reply_id: number; user_id: number }>
  ) {
    const ticket = await reply.related('ticket').query().first()
    if (!ticket) return

    for (const mention of mentions) {
      await TicketActivity.create({
        ticketId: ticket.id,
        type: 'mention',
        properties: {
          mentioned_user_id: mention.user_id,
          reply_id: reply.id,
          message: `You were mentioned in ticket #${ticket.reference}`,
        },
      })
    }
  }
}
