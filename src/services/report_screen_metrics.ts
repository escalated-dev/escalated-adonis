import { DateTime } from 'luxon'
import Ticket from '../models/ticket.js'
import type AdvancedReportingService from './advanced_reporting_service.js'

/**
 * The figures the report screens read, in the shape they read them.
 *
 * AdvancedReportingService answers the API, where a report is a nested object --
 * a distribution with its buckets, stats and percentiles inside it. The screens
 * read something flatter and differently named: a list of `{ label, value }` per
 * chart, four headline numbers per screen.
 *
 * Keeping that here rather than in the controller means the mapping sits next to
 * the data, and leaves the service answering one question.
 */
export default class ReportScreenMetrics {
  /**
   * What the two time screens measure "on target" against. They show the share
   * met inside it, so it has to be stated somewhere.
   */
  static readonly FIRST_RESPONSE_TARGET_HOURS = 4
  static readonly RESOLUTION_TARGET_HOURS = 24

  constructor(
    private service: AdvancedReportingService,
    private from: DateTime,
    private to: DateTime
  ) {}

  /**
   * Average, median, P90 and the share answered inside target.
   *
   * The distribution and the trend are the body of the first-response screen;
   * these are the four tiles above them, and without them it renders zeroes over
   * a chart that is plainly not describing zero.
   */
  async frtSummary() {
    return this.summarise(
      await this.hoursBetween('firstResponseAt'),
      ReportScreenMetrics.FIRST_RESPONSE_TARGET_HOURS
    )
  }

  async resolutionSummary() {
    return this.summarise(
      await this.hoursBetween('resolvedAt'),
      ReportScreenMetrics.RESOLUTION_TARGET_HOURS
    )
  }

  /** Counts for the SLA screen, over the same window as its trends. */
  async slaBreachCounts() {
    const tickets = await this.windowQuery()
    const firstResponse = tickets.filter((t) => t.slaFirstResponseBreached).length
    const resolution = tickets.filter((t) => t.slaResolutionBreached).length
    const breached = tickets.filter(
      (t) => t.slaFirstResponseBreached || t.slaResolutionBreached
    ).length

    return {
      total: breached,
      rate: tickets.length > 0 ? Math.round((breached / tickets.length) * 1000) / 10 : 0,
      first_response: firstResponse,
      resolution,
    }
  }

  async frtByDepartment() {
    return this.averageHoursBy('departmentId', 'firstResponseAt')
  }

  async frtByPriority() {
    return this.averageHoursBy('priority', 'firstResponseAt')
  }

  async resolutionByDepartment() {
    return this.averageHoursBy('departmentId', 'resolvedAt')
  }

  async resolutionByChannel() {
    return this.averageHoursBy('channel', 'resolvedAt')
  }

  async slaBreachByDepartment() {
    return this.countsBy(
      'departmentId',
      (t) => t.slaFirstResponseBreached || t.slaResolutionBreached
    )
  }

  async slaBreachByPriority() {
    return this.countsBy('priority', (t) => t.slaFirstResponseBreached || t.slaResolutionBreached)
  }

  /**
   * Tickets raised per day over an arbitrary window.
   *
   * The comparison screen charts both of its periods, and only one of them is
   * the window this service was built around.
   */
  async volumeByDate(from: DateTime, to: DateTime) {
    const days = Math.min(Math.max(Math.ceil(to.diff(from, 'days').days) + 1, 1), 90)
    const series = []

    for (let offset = 0; offset < days; offset += 1) {
      const day = from.plus({ days: offset }).startOf('day')
      const count = await Ticket.query()
        .whereBetween('created_at', [day.toSQL()!, day.endOf('day').toSQL()!])
        .count('* as total')
        .first()

      series.push({ label: day.toISODate(), value: Number(count?.$extras?.total ?? 0) })
    }

    return series
  }

  /**
   * Open tickets whose SLA is close but not yet missed, soonest first. The
   * screen sorts them into bands by hoursRemaining.
   */
  async atRiskTickets(withinHours = 8, limit = 50) {
    const now = DateTime.now()
    const deadline = now.plus({ hours: withinHours })

    const tickets = await Ticket.query()
      .whereNull('resolved_at')
      .where('sla_resolution_breached', false)
      .whereBetween('resolution_due_at', [now.toSQL()!, deadline.toSQL()!])
      .orderBy('resolution_due_at', 'asc')
      .limit(limit)

    return tickets.map((ticket) => ({
      id: ticket.id,
      reference: ticket.reference,
      subject: ticket.subject,
      priority: ticket.priority,
      hours_remaining:
        Math.round(
          DateTime.fromJSDate(ticket.resolutionDueAt as any).diff(now, 'hours').hours * 10
        ) / 10,
    }))
  }

  /** Resolution time per agent, the same shape as the service's FRT one. */
  async resolutionByAgent() {
    const inWindow = await this.windowQuery()
    const tickets = inWindow.filter((t) => t.resolvedAt && t.assignedTo)
    const grouped = new Map<unknown, number[]>()

    for (const ticket of tickets) {
      const hours = DateTime.fromJSDate(ticket.resolvedAt as any).diff(
        DateTime.fromJSDate(ticket.createdAt as any),
        'hours'
      ).hours

      if (!grouped.has(ticket.assignedTo)) grouped.set(ticket.assignedTo, [])
      grouped.get(ticket.assignedTo)!.push(hours)
    }

    const rows = []
    for (const [agentId, hours] of grouped) {
      const sorted = [...hours].sort((a, b) => a - b)
      rows.push({
        agent_id: agentId,
        agent_name: String(agentId),
        avg_hours: Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100,
        count: sorted.length,
        percentiles: { p50: this.pct(sorted, 50), p90: this.pct(sorted, 90) },
      })
    }

    return rows.sort((a, b) => a.avg_hours - b.avg_hours)
  }

  /** Every chart on these screens reads `{ label, value }`. */
  static chartSeries(rows: any[], labelKey: string, valueKey: string) {
    return rows.map((row) => ({ label: row[labelKey], value: row[valueKey] ?? 0 }))
  }

  static distributionSeries(distribution: any) {
    return (distribution.buckets ?? []).map((bucket: any) => ({
      label: bucket.range,
      value: bucket.count,
    }))
  }

  /** The agent table on the time screens sorts on these four keys. */
  static agentTimeRows(rows: any[]) {
    return rows.map((row) => ({
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      count: row.count,
      avg: row.avg_hours,
      median: row.percentiles?.p50 ?? 0,
      p90: row.percentiles?.p90 ?? 0,
    }))
  }

  static cohortRows(rows: unknown) {
    if (!Array.isArray(rows)) return []

    return rows.map((row: any) => ({
      name: row.name,
      volume: row.total,
      avg_resolution: row.avg_resolution_hours ?? 0,
      breach_rate: row.breach_rate ?? 0,
      csat: row.csat ?? 0,
    }))
  }

  static agentRankingRows(rows: any[]) {
    return rows.map((row) => ({
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      volume: row.total_tickets,
      resolution_rate: row.resolution_rate,
      avg_frt: row.avg_frt_hours,
      avg_resolution: row.avg_resolution_hours,
      csat: row.avg_csat,
      composite_score: row.composite_score,
    }))
  }

  static comparisonSide(stats: any, volumeTrend: unknown[]) {
    return {
      total_tickets: stats.total_created,
      resolved_tickets: stats.total_resolved,
      avg_frt: stats.avg_frt_hours ?? 0,
      avg_resolution: stats.avg_resolution_hours ?? 0,
      sla_compliance: stats.resolution_rate,
      csat: stats.csat ?? 0,
      breach_count: stats.sla_breaches,
      volume_trend: volumeTrend,
    }
  }

  private windowQuery() {
    return Ticket.query().whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
  }

  private async hoursBetween(stamp: 'firstResponseAt' | 'resolvedAt') {
    const tickets = await this.windowQuery()

    return tickets
      .filter((ticket) => ticket[stamp])
      .map(
        (ticket) =>
          DateTime.fromJSDate(ticket[stamp] as any).diff(
            DateTime.fromJSDate(ticket.createdAt as any),
            'hours'
          ).hours
      )
  }

  private summarise(values: number[], targetHours: number) {
    if (values.length === 0) return { avg: 0, median: 0, p90: 0, pct_under_target: 0 }

    const sorted = [...values].sort((a, b) => a - b)
    const within = sorted.filter((value) => value <= targetHours).length

    return {
      avg: Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100,
      median: this.pct(sorted, 50),
      p90: this.pct(sorted, 90),
      pct_under_target: Math.round((within / sorted.length) * 1000) / 10,
    }
  }

  private async averageHoursBy(field: keyof Ticket, stamp: 'firstResponseAt' | 'resolvedAt') {
    const inWindow = await this.windowQuery()
    const tickets = inWindow.filter((ticket) => ticket[stamp])
    const grouped = new Map<string, number[]>()

    for (const ticket of tickets) {
      const label = String(ticket[field] ?? 'unknown')
      const hours = DateTime.fromJSDate(ticket[stamp] as any).diff(
        DateTime.fromJSDate(ticket.createdAt as any),
        'hours'
      ).hours

      if (!grouped.has(label)) grouped.set(label, [])
      grouped.get(label)!.push(hours)
    }

    return [...grouped.entries()]
      .map(([label, hours]) => ({
        label,
        value: Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value)
  }

  private async countsBy(field: keyof Ticket, matches: (ticket: Ticket) => boolean) {
    const inWindow = await this.windowQuery()
    const tickets = inWindow.filter(matches)
    const grouped = new Map<string, number>()

    for (const ticket of tickets) {
      const label = String(ticket[field] ?? 'unknown')
      grouped.set(label, (grouped.get(label) ?? 0) + 1)
    }

    return [...grouped.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  }

  private pct(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    if (sorted.length === 1) return Math.round(sorted[0] * 100) / 100

    const k = (p / 100) * (sorted.length - 1)
    const floor = Math.floor(k)
    const ceil = Math.ceil(k)

    if (floor === ceil) return Math.round(sorted[floor] * 100) / 100

    return Math.round((sorted[floor] + (k - floor) * (sorted[ceil] - sorted[floor])) * 100) / 100
  }
}
