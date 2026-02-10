import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../models/ticket.js'
import SatisfactionRating from '../models/satisfaction_rating.js'

export default class AdminReportsController {
  async handle({ request, inertia }: HttpContext) {
    const days = Number(request.input('days', 30))
    const since = DateTime.now().minus({ days }).toSQL()!

    const { default: db } = await import('@adonisjs/lucid/services/db')

    const totalTickets = await Ticket.query()
      .where('created_at', '>=', since)
      .count('* as total')
      .first()

    const resolvedTickets = await Ticket.query()
      .whereNotNull('resolved_at')
      .where('resolved_at', '>=', since)
      .count('* as total')
      .first()

    const avgFirstResponse = await this.avgFirstResponseHours(since, db)

    const slaBreachCount = await Ticket.query()
      .where('created_at', '>=', since)
      .where((q) => {
        q.where('sla_first_response_breached', true)
          .orWhere('sla_resolution_breached', true)
      })
      .count('* as total')
      .first()

    const byStatus = await db
      .from('escalated_tickets')
      .where('created_at', '>=', since)
      .select('status')
      .count('* as count')
      .groupBy('status')

    const byPriority = await db
      .from('escalated_tickets')
      .where('created_at', '>=', since)
      .select('priority')
      .count('* as count')
      .groupBy('priority')

    const csat = await this.getCsatMetrics(since, db)

    // Convert by_status and by_priority to key-value maps
    const byStatusMap: Record<string, number> = {}
    for (const row of byStatus) {
      byStatusMap[row.status] = Number(row.count)
    }

    const byPriorityMap: Record<string, number> = {}
    for (const row of byPriority) {
      byPriorityMap[row.priority] = Number(row.count)
    }

    return inertia.render('Escalated/Admin/Reports', {
      period_days: days,
      total_tickets: Number((totalTickets as any)?.$extras?.total ?? 0),
      resolved_tickets: Number((resolvedTickets as any)?.$extras?.total ?? 0),
      avg_first_response_hours: avgFirstResponse,
      sla_breach_count: Number((slaBreachCount as any)?.$extras?.total ?? 0),
      by_status: byStatusMap,
      by_priority: byPriorityMap,
      csat,
    })
  }

  protected async avgFirstResponseHours(since: string, db: any): Promise<number> {
    const driver = db.connection().dialect.name

    let raw: string
    if (driver === 'sqlite' || driver === 'better-sqlite3') {
      raw = 'AVG((julianday(first_response_at) - julianday(created_at)) * 24) as avg_hours'
    } else {
      raw = 'AVG(TIMESTAMPDIFF(HOUR, created_at, first_response_at)) as avg_hours'
    }

    const result = await db
      .from('escalated_tickets')
      .whereNotNull('first_response_at')
      .where('created_at', '>=', since)
      .select(db.raw(raw))
      .first()

    return Math.round((Number(result?.avg_hours ?? 0)) * 10) / 10
  }

  protected async getCsatMetrics(since: string, db: any) {
    const avgResult = await db
      .from('escalated_satisfaction_ratings')
      .where('created_at', '>=', since)
      .avg('rating as average')
      .count('* as total')
      .first()

    const breakdown = await db
      .from('escalated_satisfaction_ratings')
      .where('created_at', '>=', since)
      .select('rating')
      .count('* as count')
      .groupBy('rating')

    const breakdownMap: Record<number, number> = {}
    for (const row of breakdown) {
      breakdownMap[row.rating] = Number(row.count)
    }

    return {
      average: Math.round((Number(avgResult?.average ?? 0)) * 10) / 10,
      total: Number(avgResult?.total ?? 0),
      breakdown: breakdownMap,
    }
  }
}
