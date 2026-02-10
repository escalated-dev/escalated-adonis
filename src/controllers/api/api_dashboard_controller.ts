import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../../models/ticket.js'

export default class ApiDashboardController {
  /**
   * GET /dashboard — Agent dashboard stats as JSON
   */
  async handle(ctx: HttpContext) {
    const userId = (ctx as any).auth.user.id
    const startOfDay = DateTime.now().startOf('day').toSQL()!
    const startOfWeek = DateTime.now().startOf('week').toSQL()!

    const openCount = await Ticket.query()
      .whereNotIn('status', ['resolved', 'closed'])
      .count('* as total')
      .first()

    const myAssignedCount = await Ticket.query()
      .where('assigned_to', userId)
      .whereNotIn('status', ['resolved', 'closed'])
      .count('* as total')
      .first()

    const unassignedCount = await Ticket.query()
      .whereNull('assigned_to')
      .whereNotIn('status', ['resolved', 'closed'])
      .count('* as total')
      .first()

    const slaBreachedCount = await Ticket.query()
      .whereNotIn('status', ['resolved', 'closed'])
      .where((q) => {
        q.where('sla_first_response_breached', true)
          .orWhere('sla_resolution_breached', true)
      })
      .count('* as total')
      .first()

    const resolvedTodayCount = await Ticket.query()
      .where('resolved_at', '>=', startOfDay)
      .count('* as total')
      .first()

    const recentTickets = await Ticket.query()
      .preload('department')
      .orderBy('created_at', 'desc')
      .limit(10)

    const slaBreaching = await Ticket.query()
      .whereNotIn('status', ['resolved', 'closed'])
      .where((q) => {
        q.where('sla_first_response_breached', true)
          .orWhere('sla_resolution_breached', true)
      })
      .limit(5)

    const unassignedUrgent = await Ticket.query()
      .whereNull('assigned_to')
      .whereNotIn('status', ['resolved', 'closed'])
      .whereIn('priority', ['urgent', 'critical'])
      .limit(5)

    const resolvedThisWeekCount = await Ticket.query()
      .where('assigned_to', userId)
      .where('resolved_at', '>=', startOfWeek)
      .count('* as total')
      .first()

    return ctx.response.json({
      stats: {
        open: Number((openCount as any)?.$extras?.total ?? 0),
        my_assigned: Number((myAssignedCount as any)?.$extras?.total ?? 0),
        unassigned: Number((unassignedCount as any)?.$extras?.total ?? 0),
        sla_breached: Number((slaBreachedCount as any)?.$extras?.total ?? 0),
        resolved_today: Number((resolvedTodayCount as any)?.$extras?.total ?? 0),
      },
      recent_tickets: recentTickets.map((t) => ({
        id: t.id,
        reference: t.reference,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        requester_name: t.requesterName,
        assignee_name: null, // Assignee loaded separately in full implementation
        created_at: t.createdAt.toISO(),
      })),
      needs_attention: {
        sla_breaching: slaBreaching.map((t) => ({
          reference: t.reference,
          subject: t.subject,
          priority: t.priority,
          requester_name: t.requesterName,
        })),
        unassigned_urgent: unassignedUrgent.map((t) => ({
          reference: t.reference,
          subject: t.subject,
          priority: t.priority,
          requester_name: t.requesterName,
        })),
      },
      my_performance: {
        resolved_this_week: Number((resolvedThisWeekCount as any)?.$extras?.total ?? 0),
      },
    })
  }
}
