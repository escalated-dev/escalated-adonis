import { DateTime } from 'luxon'
import Ticket from '../models/ticket.js'
import Tag from '../models/tag.js'
import Department from '../models/department.js'
import SatisfactionRating from '../models/satisfaction_rating.js'

interface Percentiles {
  p50: number
  p75: number
  p90: number
  p95: number
  p99: number
}

export default class AdvancedReportingService {
  constructor(
    private from: DateTime,
    private to: DateTime
  ) {}

  async slaBreachTrends() {
    const dates = this.dateSeries()
    const results = []
    for (const date of dates) {
      const dayStart = date.startOf('day')
      const dayEnd = date.endOf('day')
      const frtBreaches = await Ticket.query()
        .where('sla_first_response_breached', true)
        .whereNull('first_response_at')
        .whereBetween('sla_first_response_due_at', [dayStart.toSQL()!, dayEnd.toSQL()!])
        .count('* as total')
        .first()
      const resBreaches = await Ticket.query()
        .where('sla_resolution_breached', true)
        .whereNull('resolved_at')
        .whereBetween('sla_resolution_due_at', [dayStart.toSQL()!, dayEnd.toSQL()!])
        .count('* as total')
        .first()
      results.push({
        date: date.toISODate(),
        frt_breaches: Number(frtBreaches?.$extras?.total ?? 0),
        resolution_breaches: Number(resBreaches?.$extras?.total ?? 0),
      })
    }
    return results
  }

  async frtDistribution() {
    const tickets = await Ticket.query()
      .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
      .whereNotNull('first_response_at')
    const values = tickets.map(
      (t) =>
        DateTime.fromJSDate(t.firstResponseAt as any).diff(
          DateTime.fromJSDate(t.createdAt as any),
          'hours'
        ).hours
    )
    return this.buildDistribution(values, 'hours')
  }

  async frtTrends() {
    const dates = this.dateSeries()
    const results = []
    for (const date of dates) {
      const dayStart = date.startOf('day')
      const dayEnd = date.endOf('day')
      const tickets = await Ticket.query()
        .whereBetween('first_response_at', [dayStart.toSQL()!, dayEnd.toSQL()!])
        .whereNotNull('first_response_at')
      const frts = tickets.map(
        (t) =>
          DateTime.fromJSDate(t.firstResponseAt as any).diff(
            DateTime.fromJSDate(t.createdAt as any),
            'hours'
          ).hours
      )
      results.push({
        date: date.toISODate(),
        avg_hours:
          frts.length > 0
            ? Math.round((frts.reduce((a, b) => a + b, 0) / frts.length) * 100) / 100
            : null,
        count: frts.length,
        percentiles: frts.length > 0 ? this.percentiles(frts) : {},
      })
    }
    return results
  }

  async frtByAgent() {
    const tickets = await Ticket.query()
      .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
      .whereNotNull('first_response_at')
      .whereNotNull('assigned_to')
    const grouped = new Map<number, number[]>()
    for (const t of tickets) {
      const frt = DateTime.fromJSDate(t.firstResponseAt as any).diff(
        DateTime.fromJSDate(t.createdAt as any),
        'hours'
      ).hours
      if (!grouped.has(t.assignedTo!)) grouped.set(t.assignedTo!, [])
      grouped.get(t.assignedTo!)!.push(frt)
    }
    const results = []
    for (const [agentId, frts] of grouped) {
      results.push({
        agent_id: agentId,
        avg_hours: Math.round((frts.reduce((a, b) => a + b, 0) / frts.length) * 100) / 100,
        count: frts.length,
        percentiles: this.percentiles(frts),
      })
    }
    return results.sort((a, b) => a.avg_hours - b.avg_hours)
  }

  async resolutionTimeDistribution() {
    const tickets = await Ticket.query()
      .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
      .whereNotNull('resolved_at')
    const values = tickets.map(
      (t) =>
        DateTime.fromJSDate(t.resolvedAt as any).diff(
          DateTime.fromJSDate(t.createdAt as any),
          'hours'
        ).hours
    )
    return this.buildDistribution(values, 'hours')
  }

  async resolutionTimeTrends() {
    const dates = this.dateSeries()
    const results = []
    for (const date of dates) {
      const dayStart = date.startOf('day')
      const dayEnd = date.endOf('day')
      const tickets = await Ticket.query()
        .whereBetween('resolved_at', [dayStart.toSQL()!, dayEnd.toSQL()!])
        .whereNotNull('resolved_at')
      const times = tickets.map(
        (t) =>
          DateTime.fromJSDate(t.resolvedAt as any).diff(
            DateTime.fromJSDate(t.createdAt as any),
            'hours'
          ).hours
      )
      results.push({
        date: date.toISODate(),
        avg_hours:
          times.length > 0
            ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100
            : null,
        count: times.length,
        percentiles: times.length > 0 ? this.percentiles(times) : {},
      })
    }
    return results
  }

  async agentPerformanceRanking() {
    const tickets = await Ticket.query()
      .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
      .whereNotNull('assigned_to')
    const agentMap = new Map<number, typeof tickets>()
    for (const t of tickets) {
      if (!agentMap.has(t.assignedTo!)) agentMap.set(t.assignedTo!, [])
      agentMap.get(t.assignedTo!)!.push(t)
    }
    const rankings = []
    for (const [agentId, agentTickets] of agentMap) {
      const resolved = agentTickets.filter((t) => t.resolvedAt)
      const total = agentTickets.length
      const resRate = total > 0 ? Math.round((resolved.length / total) * 1000) / 10 : 0
      const frts = agentTickets
        .filter((t) => t.firstResponseAt)
        .map(
          (t) =>
            DateTime.fromJSDate(t.firstResponseAt as any).diff(
              DateTime.fromJSDate(t.createdAt as any),
              'hours'
            ).hours
        )
      const resTimes = resolved.map(
        (t) =>
          DateTime.fromJSDate(t.resolvedAt as any).diff(
            DateTime.fromJSDate(t.createdAt as any),
            'hours'
          ).hours
      )
      const avgFrt =
        frts.length > 0
          ? Math.round((frts.reduce((a, b) => a + b, 0) / frts.length) * 100) / 100
          : null
      const avgRes =
        resTimes.length > 0
          ? Math.round((resTimes.reduce((a, b) => a + b, 0) / resTimes.length) * 100) / 100
          : null
      const csatResult = await SatisfactionRating.query()
        .whereHas('ticket', (q) => q.where('assigned_to', agentId))
        .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
        .avg('rating as avg_rating')
        .first()
      const avgCsat = csatResult?.$extras?.avg_rating
        ? Math.round(csatResult.$extras.avg_rating * 100) / 100
        : null
      rankings.push({
        agent_id: agentId,
        total_tickets: total,
        resolved_count: resolved.length,
        resolution_rate: resRate,
        avg_frt_hours: avgFrt,
        avg_resolution_hours: avgRes,
        avg_csat: avgCsat,
        composite_score: this.compositeScore(resRate, avgFrt, avgRes, avgCsat),
      })
    }
    return rankings.sort((a, b) => (b.composite_score ?? 0) - (a.composite_score ?? 0))
  }

  async cohortAnalysis(dimension: string) {
    switch (dimension) {
      case 'tag':
        return this.cohortByTag()
      case 'department':
        return this.cohortByDepartment()
      case 'channel':
        return this.cohortByChannel()
      case 'type':
        return this.cohortByType()
      default:
        return { error: `Unknown dimension: ${dimension}` }
    }
  }

  async periodComparison() {
    const duration = this.to.diff(this.from, 'milliseconds').milliseconds
    const prevFrom = this.from.minus({ milliseconds: duration })
    const prevTo = this.from
    const current = await this.periodStats(this.from, this.to)
    const previous = await this.periodStats(prevFrom, prevTo)
    return {
      current,
      previous,
      changes: this.calculateChanges(current, previous),
    }
  }

  // Private helpers
  private dateSeries(): DateTime[] {
    const days = Math.min(Math.max(this.to.diff(this.from, 'days').days + 1, 1), 90)
    return Array.from({ length: Math.ceil(days) }, (_, i) =>
      this.from.plus({ days: i }).startOf('day')
    )
  }

  private percentiles(values: number[]): Percentiles {
    const sorted = [...values].sort((a, b) => a - b)
    return {
      p50: this.pct(sorted, 50),
      p75: this.pct(sorted, 75),
      p90: this.pct(sorted, 90),
      p95: this.pct(sorted, 95),
      p99: this.pct(sorted, 99),
    }
  }

  private pct(sorted: number[], p: number): number {
    if (sorted.length === 1) return Math.round(sorted[0] * 100) / 100
    const k = (p / 100) * (sorted.length - 1)
    const f = Math.floor(k)
    const c = Math.ceil(k)
    if (f === c) return Math.round(sorted[f] * 100) / 100
    return Math.round((sorted[f] + (k - f) * (sorted[c] - sorted[f])) * 100) / 100
  }

  private buildDistribution(values: number[], unit: string) {
    if (values.length === 0) return { buckets: [], stats: {} }
    const sorted = [...values].sort((a, b) => a - b)
    const max = sorted[sorted.length - 1]
    const bucketSize = Math.max(Math.ceil(max / 10), 1)
    const buckets = []
    for (let start = 0; start <= Math.ceil(max); start += bucketSize) {
      const end = start + bucketSize
      const count = sorted.filter((v) => v >= start && v < end).length
      if (count > 0) buckets.push({ range: `${start}-${end}`, count })
    }
    return {
      buckets,
      stats: {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100) / 100,
        median: this.pct(sorted, 50),
        count: sorted.length,
        unit,
      },
      percentiles: this.percentiles(sorted),
    }
  }

  private compositeScore(
    resRate: number,
    avgFrt: number | null,
    avgRes: number | null,
    avgCsat: number | null
  ): number {
    let score = 0
    let weights = 0
    score += (resRate / 100) * 30
    weights += 30
    if (avgFrt && avgFrt > 0) {
      score += Math.max(1 - avgFrt / 24, 0) * 25
      weights += 25
    }
    if (avgRes && avgRes > 0) {
      score += Math.max(1 - avgRes / 72, 0) * 25
      weights += 25
    }
    if (avgCsat !== null) {
      score += (avgCsat / 5) * 20
      weights += 20
    }
    return weights > 0 ? Math.round((score / weights) * 1000) / 10 : 0
  }

  private async cohortByTag() {
    const tags = await Tag.all()
    const results = []
    for (const tag of tags) {
      const scope = Ticket.query()
        .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
        .whereHas('tags', (q) => q.where('id', tag.id))
      results.push(await this.buildCohort(tag.name, scope))
    }
    return results
  }

  private async cohortByDepartment() {
    const depts = await Department.all()
    const results = []
    for (const dept of depts) {
      const scope = Ticket.query()
        .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
        .where('department_id', dept.id)
      results.push(await this.buildCohort(dept.name, scope))
    }
    return results
  }

  private async cohortByChannel() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const channels = await db
      .from('escalated_tickets')
      .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
      .whereNotNull('channel')
      .distinct('channel')
      .pluck('channel')
    const results = []
    for (const ch of channels) {
      const scope = Ticket.query()
        .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
        .where('channel', ch)
      results.push(await this.buildCohort(ch, scope))
    }
    return results
  }

  private async cohortByType() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const types = await db
      .from('escalated_tickets')
      .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
      .whereNotNull('ticket_type')
      .distinct('ticket_type')
      .pluck('ticket_type')
    const results = []
    for (const t of types) {
      const scope = Ticket.query()
        .whereBetween('created_at', [this.from.toSQL()!, this.to.toSQL()!])
        .where('ticket_type', t)
      results.push(await this.buildCohort(t, scope))
    }
    return results
  }

  private async buildCohort(name: string, query: ReturnType<typeof Ticket.query>) {
    const tickets = await query
    const resolved = tickets.filter((t) => t.resolvedAt)
    const total = tickets.length
    const resTimes = resolved.map(
      (t) =>
        DateTime.fromJSDate(t.resolvedAt as any).diff(
          DateTime.fromJSDate(t.createdAt as any),
          'hours'
        ).hours
    )
    const frts = tickets
      .filter((t) => t.firstResponseAt)
      .map(
        (t) =>
          DateTime.fromJSDate(t.firstResponseAt as any).diff(
            DateTime.fromJSDate(t.createdAt as any),
            'hours'
          ).hours
      )
    return {
      name,
      total,
      resolved: resolved.length,
      resolution_rate: total > 0 ? Math.round((resolved.length / total) * 1000) / 10 : 0,
      avg_resolution_hours:
        resTimes.length > 0
          ? Math.round((resTimes.reduce((a, b) => a + b, 0) / resTimes.length) * 100) / 100
          : null,
      avg_frt_hours:
        frts.length > 0
          ? Math.round((frts.reduce((a, b) => a + b, 0) / frts.length) * 100) / 100
          : null,
      percentiles: {
        resolution: resTimes.length > 0 ? this.percentiles(resTimes) : {},
        frt: frts.length > 0 ? this.percentiles(frts) : {},
      },
    }
  }

  private async periodStats(from: DateTime, to: DateTime) {
    const tickets = await Ticket.query().whereBetween('created_at', [from.toSQL()!, to.toSQL()!])
    const resolved = tickets.filter((t) => t.resolvedAt)
    const total = tickets.length
    const resTimes = resolved.map(
      (t) =>
        DateTime.fromJSDate(t.resolvedAt as any).diff(
          DateTime.fromJSDate(t.createdAt as any),
          'hours'
        ).hours
    )
    const frts = tickets
      .filter((t) => t.firstResponseAt)
      .map(
        (t) =>
          DateTime.fromJSDate(t.firstResponseAt as any).diff(
            DateTime.fromJSDate(t.createdAt as any),
            'hours'
          ).hours
      )
    const slaBreaches = tickets.filter(
      (t) => (t as any).slaFirstResponseBreached || (t as any).slaResolutionBreached
    )
    return {
      total_created: total,
      total_resolved: resolved.length,
      resolution_rate: total > 0 ? Math.round((resolved.length / total) * 1000) / 10 : 0,
      avg_frt_hours:
        frts.length > 0
          ? Math.round((frts.reduce((a, b) => a + b, 0) / frts.length) * 100) / 100
          : null,
      avg_resolution_hours:
        resTimes.length > 0
          ? Math.round((resTimes.reduce((a, b) => a + b, 0) / resTimes.length) * 100) / 100
          : null,
      sla_breaches: slaBreaches.length,
      percentiles: {
        resolution: resTimes.length > 0 ? this.percentiles(resTimes) : {},
        frt: frts.length > 0 ? this.percentiles(frts) : {},
      },
    }
  }

  private calculateChanges(current: Record<string, any>, previous: Record<string, any>) {
    const keys = [
      'total_created',
      'total_resolved',
      'resolution_rate',
      'avg_frt_hours',
      'avg_resolution_hours',
    ]
    const changes: Record<string, number> = {}
    for (const key of keys) {
      const cur = Number(current[key] ?? 0)
      const prev = Number(previous[key] ?? 0)
      changes[key] =
        prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 1000) / 10
    }
    return changes
  }
}
