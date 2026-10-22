import { getConfig } from '../helpers/config.js'
import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import SlaPolicy from '../models/sla_policy.js'
import BusinessSchedule from '../models/business_schedule.js'
import Department from '../models/department.js'
import { addBusinessMinutes } from '../support/business_hours.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import type { TicketPriority } from '../types.js'

export default class SlaService {
  /**
   * Attach the default SLA policy to a ticket.
   */
  async attachDefaultPolicy(ticket: Ticket): Promise<void> {
    const policies = await SlaPolicy.query().where('is_active', true).orderBy('id')
    const rank = (policy: SlaPolicy): number => {
      const department = policy.departmentId !== null && policy.departmentId !== undefined
      const type = policy.ticketType !== null && policy.ticketType !== undefined
      if (!getConfig().targetedSlas) return !department && !type && policy.isDefault ? 0 : -1
      if (department && policy.departmentId !== ticket.departmentId) return -1
      if (type && policy.ticketType !== ticket.ticketType) return -1
      return department ? (type ? 3 : 2) : type ? 1 : policy.isDefault ? 0 : -1
    }
    const policy = policies
      .filter((item) => rank(item) >= 0)
      .sort((a, b) => rank(b) - rank(a) || a.id - b.id)[0]
    if (!policy) return

    await this.attachPolicy(ticket, policy)
  }

  /**
   * Attach an SLA policy to a ticket.
   */
  async attachPolicy(ticket: Ticket, policy: SlaPolicy): Promise<void> {
    ticket.slaPolicyId = policy.id
    ticket.firstResponseDueAt = null
    ticket.resolutionDueAt = null

    const firstResponseHours = policy.getFirstResponseHoursFor(ticket.priority as TicketPriority)
    const resolutionHours = policy.getResolutionHoursFor(ticket.priority as TicketPriority)
    const schedule = policy.businessHoursOnly ? await this.scheduleFor(policy, ticket) : null

    if (firstResponseHours) {
      ticket.firstResponseDueAt = this.dueDate(
        ticket.createdAt,
        firstResponseHours,
        policy.businessHoursOnly,
        schedule
      )
    }

    if (resolutionHours) {
      ticket.resolutionDueAt = this.dueDate(
        ticket.createdAt,
        resolutionHours,
        policy.businessHoursOnly,
        schedule
      )
    }

    await ticket.save()
  }

  /**
   * Check for SLA breaches across all open tickets.
   */
  async checkBreaches(): Promise<number> {
    let breached = 0
    const now = DateTime.now()

    // Check first response breaches
    const firstResponseTickets = await Ticket.query()
      .whereNotIn('status', ['resolved', 'closed'])
      .whereNotNull('first_response_due_at')
      .whereNull('first_response_at')
      .where('sla_first_response_breached', false)
      .where('first_response_due_at', '<', now.toSQL()!)

    for (const ticket of firstResponseTickets) {
      ticket.slaFirstResponseBreached = true
      await ticket.save()
      await emitter.emit(ESCALATED_EVENTS.SLA_BREACHED, {
        ticket,
        type: 'first_response' as const,
      })
      breached++
    }

    // Check resolution breaches
    const resolutionTickets = await Ticket.query()
      .whereNotIn('status', ['resolved', 'closed'])
      .whereNotNull('resolution_due_at')
      .where('sla_resolution_breached', false)
      .where('resolution_due_at', '<', now.toSQL()!)

    for (const ticket of resolutionTickets) {
      ticket.slaResolutionBreached = true
      await ticket.save()
      await emitter.emit(ESCALATED_EVENTS.SLA_BREACHED, {
        ticket,
        type: 'resolution' as const,
      })
      breached++
    }

    return breached
  }

  /**
   * Check for SLA warnings (approaching breach).
   */
  async checkWarnings(warningMinutes: number = 30): Promise<number> {
    let warned = 0
    const now = DateTime.now()
    const threshold = now.plus({ minutes: warningMinutes })

    // Check first response warnings
    const firstResponseWarnings = await Ticket.query()
      .whereNotIn('status', ['resolved', 'closed'])
      .whereNotNull('first_response_due_at')
      .whereNull('first_response_at')
      .where('sla_first_response_breached', false)
      .where('first_response_due_at', '>=', now.toSQL()!)
      .where('first_response_due_at', '<=', threshold.toSQL()!)

    for (const ticket of firstResponseWarnings) {
      const minutes = Math.round(ticket.firstResponseDueAt!.diff(now, 'minutes').minutes)
      await emitter.emit(ESCALATED_EVENTS.SLA_WARNING, {
        ticket,
        type: 'first_response' as const,
        minutesRemaining: minutes,
      })
      warned++
    }

    // Check resolution warnings
    const resolutionWarnings = await Ticket.query()
      .whereNotIn('status', ['resolved', 'closed'])
      .whereNotNull('resolution_due_at')
      .where('sla_resolution_breached', false)
      .where('resolution_due_at', '>=', now.toSQL()!)
      .where('resolution_due_at', '<=', threshold.toSQL()!)

    for (const ticket of resolutionWarnings) {
      const minutes = Math.round(ticket.resolutionDueAt!.diff(now, 'minutes').minutes)
      await emitter.emit(ESCALATED_EVENTS.SLA_WARNING, {
        ticket,
        type: 'resolution' as const,
        minutesRemaining: minutes,
      })
      warned++
    }

    return warned
  }

  /**
   * The business schedule a business-hours policy counts against, chosen as
   * escalated-laravel does: the policy's own schedule, then the ticket's
   * department's, then the default schedule. Null when none is configured,
   * which keeps the configured `sla.businessHours` an install had before.
   */
  async scheduleFor(policy: SlaPolicy, ticket: Ticket): Promise<BusinessSchedule | null> {
    const ids: number[] = []
    if (policy.businessScheduleId) ids.push(policy.businessScheduleId)
    if (ticket.departmentId) {
      const department = await Department.find(ticket.departmentId)
      if (department?.businessScheduleId) ids.push(department.businessScheduleId)
    }

    for (const id of ids) {
      const schedule = await BusinessSchedule.query().where('id', id).preload('holidays').first()
      if (schedule) return schedule
    }

    return BusinessSchedule.query()
      .where('is_default', true)
      .orderBy('id')
      .preload('holidays')
      .first()
  }

  protected dueDate(
    from: DateTime,
    hours: number,
    businessHoursOnly: boolean,
    schedule: BusinessSchedule | null
  ): DateTime {
    if (!businessHoursOnly || !schedule) {
      // Same instant as before, in the ticket's zone: a DateTime left in the
      // configured business-hours zone was stored as that zone's wall time
      // where the column has no offset (SQLite, MySQL DATETIME).
      return this.calculateDueDate(from, hours, businessHoursOnly).setZone(from.zone)
    }
    const due = addBusinessMinutes(from.toJSDate(), hours * 60, schedule.toCalculatorSchedule())
    return DateTime.fromJSDate(due).setZone(from.zone)
  }

  /**
   * Calculate a due date, optionally respecting business hours.
   */
  protected calculateDueDate(from: DateTime, hours: number, businessHoursOnly: boolean): DateTime {
    if (!businessHoursOnly) {
      return from.plus({ hours })
    }

    // Business hours calculation
    const config = (globalThis as any).__escalated_config?.sla?.businessHours ?? {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC',
      days: [1, 2, 3, 4, 5],
    }

    const start = config.start ?? '09:00'
    const end = config.end ?? '17:00'
    const timezone = config.timezone ?? 'UTC'
    const days: number[] = config.days ?? [1, 2, 3, 4, 5]

    let current = from.setZone(timezone)
    let remainingMinutes = hours * 60

    while (remainingMinutes > 0) {
      if (days.includes(current.weekday)) {
        const [startH, startM] = start.split(':').map(Number)
        const [endH, endM] = end.split(':').map(Number)

        const dayStart = current.set({ hour: startH, minute: startM, second: 0 })
        const dayEnd = current.set({ hour: endH, minute: endM, second: 0 })

        if (current < dayStart) {
          current = dayStart
        }

        if (current < dayEnd) {
          const availableMinutes = dayEnd.diff(current, 'minutes').minutes
          if (availableMinutes >= remainingMinutes) {
            return current.plus({ minutes: remainingMinutes })
          }
          remainingMinutes -= availableMinutes
        }
      }

      // Move to next day at start time
      const [startH, startM] = start.split(':').map(Number)
      current = current.plus({ days: 1 }).set({ hour: startH, minute: startM, second: 0 })
    }

    return current
  }
}
