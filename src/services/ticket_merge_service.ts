import emitter from '@adonisjs/core/services/emitter'
import { DateTime } from 'luxon'
import Reply from '../models/reply.js'
import type Ticket from '../models/ticket.js'
import { escalatedDb } from '../helpers/config.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import type { TicketStatus } from '../types.js'

/**
 * Merges one ticket into another, as escalated-laravel's TicketMergeService:
 * the source's replies move to the target, both tickets get a system note,
 * and the source is closed with `merged_into_id` pointing at the target.
 * All of it commits together. The source's status change and close are then
 * emitted, so notifications, webhooks and workflows see them.
 */
export default class TicketMergeService {
  async merge(source: Ticket, target: Ticket, mergedBy: any = null): Promise<void> {
    if (source.id === target.id) throw new Error('Cannot merge a ticket into itself.')
    if (source.mergedIntoId || target.mergedIntoId) {
      throw new Error('A merged ticket cannot be merged again.')
    }

    const mergedById = mergedBy?.id ?? null
    const oldStatus = source.status as TicketStatus
    const db = await escalatedDb()

    await db.transaction(async (trx) => {
      await Reply.query({ client: trx })
        .where('ticket_id', source.id)
        .update({ ticket_id: target.id })

      await Reply.create(
        {
          ticketId: target.id,
          body: `Ticket ${source.reference} was merged into this ticket.`,
          isInternalNote: true,
          isPinned: false,
          authorType: null,
          authorId: null,
          type: 'note',
          metadata: { system_note: true, merge_source: source.reference, merged_by: mergedById },
        } as any,
        { client: trx }
      )

      await Reply.create(
        {
          ticketId: source.id,
          body: `This ticket was merged into ${target.reference}.`,
          isInternalNote: true,
          isPinned: false,
          authorType: null,
          authorId: null,
          type: 'note',
          metadata: { system_note: true, merge_target: target.reference, merged_by: mergedById },
        } as any,
        { client: trx }
      )

      source.useTransaction(trx)
      source.merge({
        status: 'closed' as TicketStatus,
        closedAt: DateTime.now(),
        mergedIntoId: target.id,
      })
      await source.save()
    })

    if (oldStatus !== 'closed') {
      await emitter.emit(ESCALATED_EVENTS.TICKET_STATUS_CHANGED, {
        ticket: source,
        oldStatus,
        newStatus: 'closed' as TicketStatus,
        causer: mergedBy,
      })
      await emitter.emit(ESCALATED_EVENTS.TICKET_CLOSED, { ticket: source, causer: mergedBy })
    }
  }
}
