import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import SlaPolicy from '../models/sla_policy.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import type { TicketPriority } from '../types.js'

export default class SlaService {
  /**
   * Attach the default SLA policy to a ticket.
   */
  async attachDefaultPolicy(ticket: Ticket): Promise<void> {
    const policy = await SlaPolicy.query()
      .withScopes((scopes) => scopes.active())
      .withScopes((scopes) => scopes.isDefault())
      .first()

    if (!policy) return

    await this.attachPolicy(ticket, policy)
  }

  /**
   * Attach an SLA policy to a ticket.
   */
  async attachPolicy(ticket: Ticket, policy: SlaPolicy): Promise<void> {
    ticket.slaPolicyId = policy.id

    const firstResponseHours = policy.getFirstResponseHoursFor(ticket.priority as TicketPriority)
    const resolutionHours = policy.getResolutionHoursFor(ticket.priority as TicketPriority)

    if (firstResponseHours) {
      ticket.firstResponseDueAt = this.calculateDueDate(
        ticket.createdAt,
        firstResponseHours,
        policy.businessHoursOnly
      )
    }

    if (resolutionHours) {
      ticket.resolutionDueAt = this.calculateDueDate(
        ticket.createdAt,
        resolutionHours,
        policy.businessHoursOnly
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
      const minutes = Math.round(
        ticket.firstResponseDueAt!.diff(now, 'minutes').minutes
      )
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
      const minutes = Math.round(
        ticket.resolutionDueAt!.diff(now, 'minutes').minutes
      )
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
   * Calculate a due date, optionally respecting business hours.
   */
  protected calculateDueDate(
    from: DateTime,
    hours: number,
    businessHoursOnly: boolean
  ): DateTime {
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
