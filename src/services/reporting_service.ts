import { DateTime } from 'luxon'
import Ticket from '../models/ticket.js'
import SatisfactionRating from '../models/satisfaction_rating.js'
import SlaPolicy from '../models/sla_policy.js'
import Reply from '../models/reply.js'
import { findHostUser } from '../support/user_model.js'

/*
|--------------------------------------------------------------------------
| Reporting for the dashboard, agent, SLA, CSAT and agent detail screens
|--------------------------------------------------------------------------
|
| The figures escalated-laravel's ReportingService gives those screens, in
| the same shapes: charts as `{ label, value }`, agent rows keyed by
| `agent_id` with the agent's name, rates as percentages to one decimal.
|
| The arithmetic is done here rather than in SQL. Date and interval functions
| differ on every database this package supports, and earlier SQL here picked
| the wrong one on SQLite. The windows are a reporting period of tickets, so
| loading the rows is affordable, and the database only narrows by date.
|
*/

type Stamp = DateTime | Date | string | number | null | undefined

/** Milliseconds for whatever a date column comes back as. */
function ms(value: Stamp): number | null {
  if (value === null || value === undefined) return null
  if (DateTime.isDateTime(value)) return value.toMillis()
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  const parsed = DateTime.fromSQL(value)
  return parsed.isValid ? parsed.toMillis() : Date.parse(value)
}

function isoDate(value: Stamp): string {
  return DateTime.fromMillis(ms(value) ?? 0).toISODate()!
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

function hoursBetween(from: Stamp, to: Stamp): number | null {
  const start = ms(from)
  const end = ms(to)
  return start === null || end === null ? null : (end - start) / 3_600_000
}

function isBreached(ticket: Ticket): boolean {
  return Boolean(ticket.slaFirstResponseBreached) || Boolean(ticket.slaResolutionBreached)
}

/** Linear-interpolated percentile of an ascending list, to two decimals. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const k = (p / 100) * (sorted.length - 1)
  const floor = Math.floor(k)
  const ceil = Math.ceil(k)
  const value = sorted[floor] + (k - floor) * (sorted[ceil] - sorted[floor])
  return Math.round(value * 100) / 100
}

/** Counts per key, as `{ label, value }` in first-seen order. */
function countBy<T>(rows: T[], key: (row: T) => string): { label: string; value: number }[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1)
  return [...counts].map(([label, value]) => ({ label, value }))
}

export default class ReportingService {
  /** A window of `days` ending now. */
  static window(days: number) {
    const end = DateTime.now()
    return { start: end.minus({ days }), end }
  }

  /** Tickets created inside [start, end). */
  async ticketsCreated(start: DateTime, end: DateTime): Promise<Ticket[]> {
    // The database narrows to a day either side; the exact bounds are applied
    // here, on parsed timestamps, so they do not depend on how a driver
    // compares a timestamp with a string.
    const rows = await Ticket.query()
      .where('created_at', '>=', start.minus({ days: 1 }).toSQL()!)
      .preload('slaPolicy')
    return this.inWindow(rows, (ticket) => ticket.createdAt, start, end)
  }

  async ratingsCreated(start: DateTime, end: DateTime): Promise<SatisfactionRating[]> {
    const rows = await SatisfactionRating.query()
      .where('created_at', '>=', start.minus({ days: 1 }).toSQL()!)
      .preload('ticket')
    return this.inWindow(rows, (rating) => rating.createdAt, start, end)
  }

  // ---- Dashboard ----

  async ticketVolumeByDate(start: DateTime, end: DateTime) {
    const tickets = await this.ticketsCreated(start, end)
    tickets.sort((a, b) => (ms(a.createdAt) ?? 0) - (ms(b.createdAt) ?? 0))
    return countBy(tickets, (ticket) => isoDate(ticket.createdAt))
  }

  /** Every ticket, not only the window's, as Laravel's getTicketsByStatus. */
  async ticketsByStatus() {
    return this.countAllBy('status')
  }

  async ticketsByPriority() {
    return this.countAllBy('priority')
  }

  async averageResponseHours(start: DateTime, end: DateTime): Promise<number> {
    const tickets = await this.ticketsCreated(start, end)
    return round1(average(this.hours(tickets, 'firstResponseAt')))
  }

  async averageResolutionHours(start: DateTime, end: DateTime): Promise<number> {
    const tickets = await this.ticketsCreated(start, end)
    return round1(average(this.hours(tickets, 'resolvedAt')))
  }

  /** Share of tickets with an SLA policy that breached neither target; 100 when none had one. */
  async slaComplianceRate(start: DateTime, end: DateTime): Promise<number> {
    const tickets = (await this.ticketsCreated(start, end)).filter((t) => t.slaPolicyId !== null)
    if (tickets.length === 0) return 100
    const met = tickets.filter((ticket) => !isBreached(ticket)).length
    return round1((met / tickets.length) * 100)
  }

  async csatAverage(start: DateTime, end: DateTime): Promise<number> {
    const ratings = await this.ratingsCreated(start, end)
    return round1(average(ratings.map((rating) => Number(rating.rating))))
  }

  /**
   * One row per assigned agent: tickets, resolved, and average first response
   * and resolution hours. As in Laravel, an agent the host's user model no
   * longer finds is left out.
   */
  async agentPerformance(start: DateTime, end: DateTime) {
    const tickets = (await this.ticketsCreated(start, end)).filter((t) => t.assignedTo !== null)
    const byAgent = this.groupBy(tickets, (ticket) => ticket.assignedTo)

    const rows = []
    for (const [agentId, agentTickets] of byAgent) {
      const response = this.hours(agentTickets, 'firstResponseAt')
      const resolution = this.hours(agentTickets, 'resolvedAt')
      rows.push({
        agent_id: agentId,
        total_tickets: agentTickets.length,
        resolved_tickets: agentTickets.filter((ticket) => ticket.resolvedAt).length,
        avg_response_hours: response.length ? round1(average(response)) : null,
        avg_resolution_hours: resolution.length ? round1(average(resolution)) : null,
      })
    }

    return this.withAgentNames(rows)
  }

  // ---- SLA ----

  async slaComplianceByPolicy(start: DateTime, end: DateTime) {
    const policies = await SlaPolicy.query()
      .withScopes((s) => s.active())
      .orderBy('id', 'asc')
    const tickets = await this.ticketsCreated(start, end)

    return policies.map((policy) => {
      const forPolicy = tickets.filter((ticket) => ticket.slaPolicyId === policy.id)
      const breached = forPolicy.filter(isBreached).length
      return {
        policy_name: policy.name,
        total: forPolicy.length,
        met: forPolicy.length - breached,
        breached,
      }
    })
  }

  /** The latest 100 breached tickets, with their policy. */
  async slaBreachDetails(start: DateTime, end: DateTime) {
    const tickets = (await this.ticketsCreated(start, end)).filter(isBreached)
    tickets.sort((a, b) => (ms(b.createdAt) ?? 0) - (ms(a.createdAt) ?? 0) || b.id - a.id)

    return tickets.slice(0, 100).map((ticket) => ({
      id: ticket.id,
      reference: ticket.reference,
      subject: ticket.subject,
      assigned_to: ticket.assignedTo,
      sla_policy_id: ticket.slaPolicyId,
      sla_first_response_breached: Boolean(ticket.slaFirstResponseBreached),
      sla_resolution_breached: Boolean(ticket.slaResolutionBreached),
      first_response_at: this.iso(ticket.firstResponseAt),
      resolved_at: this.iso(ticket.resolvedAt),
      created_at: this.iso(ticket.createdAt),
      sla_policy: ticket.slaPolicy ? { id: ticket.slaPolicy.id, name: ticket.slaPolicy.name } : null,
    }))
  }

  // ---- CSAT ----

  async csatByAgent(start: DateTime, end: DateTime) {
    const ratings = (await this.ratingsCreated(start, end)).filter(
      (rating) => rating.ticket && rating.ticket.assignedTo !== null
    )
    const byAgent = this.groupBy(ratings, (rating) => rating.ticket.assignedTo)

    const rows = [...byAgent].map(([agentId, agentRatings]) => ({
      agent_id: agentId,
      avg_rating: round1(average(agentRatings.map((rating) => Number(rating.rating)))),
      total_ratings: agentRatings.length,
    }))

    return this.withAgentNames(rows)
  }

  /** Average rating per day. */
  async csatOverTime(start: DateTime, end: DateTime) {
    const ratings = await this.ratingsCreated(start, end)
    ratings.sort((a, b) => (ms(a.createdAt) ?? 0) - (ms(b.createdAt) ?? 0))
    const byDay = this.groupBy(ratings, (rating) => isoDate(rating.createdAt))

    return [...byDay].map(([label, dayRatings]) => ({
      label,
      value: round1(average(dayRatings.map((rating) => Number(rating.rating)))),
    }))
  }

  // ---- Agent detail ----

  /**
   * The figures the agent detail screen reads, for one agent over the window
   * and the same length of time before it.
   */
  async agentDetail(agentId: string | number, days: number) {
    const { start, end } = ReportingService.window(days)
    const previousStart = start.minus({ days })

    const current = await this.agentFigures(agentId, start, end)
    const previous = await this.agentFigures(agentId, previousStart, start)

    const user = await findHostUser(agentId).catch(() => null)

    return {
      agent: { id: user?.id ?? agentId, name: this.displayName(user) ?? 'Unknown' },
      total_tickets: current.totalTickets,
      resolved_tickets: current.resolvedTickets,
      avg_frt: current.avgFrt,
      avg_resolution: current.avgResolution,
      csat_score: current.csat,
      response_percentiles: current.percentiles,
      productivity: current.productivity,
      workload: current.workload,
      csat_breakdown: current.csatBreakdown,
      prev_total_tickets: previous.totalTickets,
      prev_resolved_tickets: previous.resolvedTickets,
      prev_avg_frt: previous.avgFrt,
      prev_avg_resolution: previous.avgResolution,
      prev_csat_score: previous.csat,
    }
  }

  // ---- Helpers ----

  protected async agentFigures(agentId: string | number, start: DateTime, end: DateTime) {
    const tickets = (await this.ticketsCreated(start, end)).filter(
      (ticket) => String(ticket.assignedTo) === String(agentId)
    )
    const ratings = (await this.ratingsCreated(start, end)).filter(
      (rating) => rating.ticket && String(rating.ticket.assignedTo) === String(agentId)
    )
    const response = this.hours(tickets, 'firstResponseAt').sort((a, b) => a - b)
    const resolution = this.hours(tickets, 'resolvedAt')

    const replies = await Reply.query()
      .where('author_id', String(agentId))
      .where('created_at', '>=', start.minus({ days: 1 }).toSQL()!)
    const agentReplies = this.inWindow(replies, (reply) => reply.createdAt, start, end)

    const perDay = new Map<string, { replies: number; resolutions: number }>()
    const day = (label: string) => {
      if (!perDay.has(label)) perDay.set(label, { replies: 0, resolutions: 0 })
      return perDay.get(label)!
    }
    for (const reply of agentReplies) day(isoDate(reply.createdAt)).replies += 1
    for (const ticket of tickets) if (ticket.resolvedAt) day(isoDate(ticket.resolvedAt)).resolutions += 1

    const sortedTickets = [...tickets].sort(
      (a, b) => (ms(a.createdAt) ?? 0) - (ms(b.createdAt) ?? 0)
    )

    return {
      totalTickets: tickets.length,
      resolvedTickets: tickets.filter((ticket) => ticket.resolvedAt).length,
      avgFrt: round1(average(response)),
      avgResolution: round1(average(resolution)),
      csat: ratings.length ? round1(average(ratings.map((r) => Number(r.rating)))) : null,
      percentiles: {
        p50: percentile(response, 50),
        p75: percentile(response, 75),
        p90: percentile(response, 90),
        p95: percentile(response, 95),
        p99: percentile(response, 99),
      },
      productivity: [...perDay]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, counts]) => ({
          label,
          value: counts.replies + counts.resolutions,
          values: [counts.replies, counts.resolutions],
        })),
      workload: countBy(sortedTickets, (ticket) => isoDate(ticket.createdAt)),
      csatBreakdown: countBy(
        [...ratings].sort((a, b) => Number(a.rating) - Number(b.rating)),
        (rating) => `${Number(rating.rating)} stars`
      ),
    }
  }

  protected async countAllBy(column: 'status' | 'priority') {
    const rows = await Ticket.query().select(column).count('* as total').groupBy(column)
    return rows.map((row: any) => ({ label: row[column], value: Number(row.$extras.total) }))
  }

  protected hours(tickets: Ticket[], stamp: 'firstResponseAt' | 'resolvedAt'): number[] {
    return tickets
      .map((ticket) => hoursBetween(ticket.createdAt, ticket[stamp]))
      .filter((value): value is number => value !== null)
  }

  protected inWindow<T>(rows: T[], stamp: (row: T) => Stamp, start: DateTime, end: DateTime) {
    const from = start.toMillis()
    const to = end.toMillis()
    return rows.filter((row) => {
      const at = ms(stamp(row))
      // A row stamped a moment after `end` (clock skew, a driver reading a
      // naive timestamp in another zone) still belongs to a window ending now.
      return at !== null && at >= from && (end >= DateTime.now().minus({ minutes: 1 }) || at < to)
    })
  }

  protected groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
    const grouped = new Map<K, T[]>()
    for (const row of rows) {
      const value = key(row)
      if (!grouped.has(value)) grouped.set(value, [])
      grouped.get(value)!.push(row)
    }
    return grouped
  }

  protected async withAgentNames<T extends { agent_id: unknown }>(rows: T[]) {
    const named = []
    for (const row of rows) {
      const user = await findHostUser(row.agent_id as any).catch(() => null)
      const name = this.displayName(user)
      if (name === null) continue
      named.push({ ...row, agent_name: name })
    }
    return named
  }

  protected displayName(user: any): string | null {
    if (!user) return null
    return user.name ?? user.fullName ?? user.full_name ?? user.email ?? null
  }

  protected iso(value: Stamp): string | null {
    const at = ms(value)
    return at === null ? null : DateTime.fromMillis(at).toISO()
  }
}
