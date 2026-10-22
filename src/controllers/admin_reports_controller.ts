import { DateTime } from 'luxon'
import { escalatedDb } from '../helpers/config.js'
import type { HttpContext } from '@adonisjs/core/http'
import Ticket from '../models/ticket.js'
import SatisfactionRating from '../models/satisfaction_rating.js'
import { getRenderer } from '../rendering/renderer.js'
import ReportingService from '../services/reporting_service.js'

export default class AdminReportsController {
  async handle(ctx: HttpContext) {
    const { request } = ctx
    const days = Number(request.input('days', 30))
    const since = DateTime.now().minus({ days }).toSQL()!

    const db = await escalatedDb()

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
        q.where('sla_first_response_breached', true).orWhere('sla_resolution_breached', true)
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

    return getRenderer().render(ctx, 'Escalated/Admin/Reports', {
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

  /**
   * GET {prefix}/admin/reports/dashboard — the tabbed dashboard, as
   * escalated-laravel's ReportController::dashboard.
   */
  async dashboard(ctx: HttpContext) {
    const days = this.periodDays(ctx)
    const { start, end } = ReportingService.window(days)
    const reporting = new ReportingService()

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/Dashboard', {
      period_days: days,
      volume: await reporting.ticketVolumeByDate(start, end),
      by_status: await reporting.ticketsByStatus(),
      by_priority: await reporting.ticketsByPriority(),
      avg_response_hours: await reporting.averageResponseHours(start, end),
      avg_resolution_hours: await reporting.averageResolutionHours(start, end),
      sla_compliance: await reporting.slaComplianceRate(start, end),
      csat_average: await reporting.csatAverage(start, end),
      agent_performance: await reporting.agentPerformance(start, end),
    })
  }

  /** GET {prefix}/admin/reports/agents — agent performance. */
  async agents(ctx: HttpContext) {
    const days = this.periodDays(ctx)
    const { start, end } = ReportingService.window(days)

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/AgentMetrics', {
      period_days: days,
      agents: await new ReportingService().agentPerformance(start, end),
    })
  }

  /** GET {prefix}/admin/reports/sla — SLA compliance. */
  async sla(ctx: HttpContext) {
    const days = this.periodDays(ctx)
    const { start, end } = ReportingService.window(days)
    const reporting = new ReportingService()

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/SlaReport', {
      period_days: days,
      compliance_rate: await reporting.slaComplianceRate(start, end),
      compliance_by_policy: await reporting.slaComplianceByPolicy(start, end),
      breaches: await reporting.slaBreachDetails(start, end),
    })
  }

  /** GET {prefix}/admin/reports/csat — satisfaction ratings. */
  async csat(ctx: HttpContext) {
    const days = this.periodDays(ctx)
    const { start, end } = ReportingService.window(days)
    const reporting = new ReportingService()

    const tickets = await reporting.ticketsCreated(start, end)
    const ratings = await reporting.ratingsCreated(start, end)
    const totalTickets = tickets.length
    const totalRatings = ratings.length

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/CsatReport', {
      period_days: days,
      csat_average: await reporting.csatAverage(start, end),
      response_rate: totalTickets > 0 ? Math.round((totalRatings / totalTickets) * 1000) / 10 : 0,
      total_ratings: totalRatings,
      by_agent: await reporting.csatByAgent(start, end),
      over_time: await reporting.csatOverTime(start, end),
    })
  }

  /**
   * GET {prefix}/admin/reports/agent/:id/detail — one agent.
   *
   * Laravel sends this screen `metrics` and `percentiles`, which it does not
   * read; these are the props it does read (agent, the four headline figures
   * and the previous period's, percentiles, productivity, workload, CSAT).
   */
  async agentDetail(ctx: HttpContext) {
    const days = this.periodDays(ctx)
    const id = ctx.params.id

    return getRenderer().render(ctx, 'Escalated/Admin/Reports/AgentDetail', {
      period_days: days,
      agent_id: Number.isNaN(Number(id)) ? id : Number(id),
      ...(await new ReportingService().agentDetail(id, days)),
    })
  }

  /** `days` from the query, 1 to 365, default 30. */
  protected periodDays(ctx: HttpContext): number {
    const days = Number.parseInt(String(ctx.request.input('days', 30)), 10)
    if (!Number.isFinite(days) || days < 1) return 30
    return Math.min(days, 365)
  }

  protected async avgFirstResponseHours(since: string, _db?: unknown): Promise<number> {
    // Escalated's own connection, not the host's default: this reads
    // escalated_tickets, which moves with the package.
    const connection = await escalatedDb()
    const driver = connection.dialect.name

    // 'sqlite3' is what Knex actually reports. This used to compare against
    // 'sqlite', which is not a dialect name any driver returns, so the branch
    // never fired and SQLite hosts were handed MySQL's TIMESTAMPDIFF -- a
    // function SQLite does not have. Typing the connection surfaced it.
    let raw: string
    if (driver === 'sqlite3' || driver === 'better-sqlite3' || driver === 'libsql') {
      raw = 'AVG((julianday(first_response_at) - julianday(created_at)) * 24) as avg_hours'
    } else {
      raw = 'AVG(TIMESTAMPDIFF(HOUR, created_at, first_response_at)) as avg_hours'
    }

    const result = await connection
      .from('escalated_tickets')
      .whereNotNull('first_response_at')
      .where('created_at', '>=', since)
      .select(connection.raw(raw))
      .first()

    return Math.round(Number(result?.avg_hours ?? 0) * 10) / 10
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
      average: Math.round(Number(avgResult?.average ?? 0) * 10) / 10,
      total: Number(avgResult?.total ?? 0),
      breakdown: breakdownMap,
    }
  }
}
