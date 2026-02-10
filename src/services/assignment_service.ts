import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import TicketActivity from '../models/ticket_activity.js'
import Department from '../models/department.js'
import { ESCALATED_EVENTS } from '../events/index.js'

export default class AssignmentService {
  /**
   * Assign a ticket to an agent.
   */
  async assign(ticket: Ticket, agentId: number, causer?: any): Promise<Ticket> {
    ticket.assignedTo = agentId
    await ticket.save()

    await TicketActivity.create({
      ticketId: ticket.id,
      type: 'assigned',
      causerType: causer?.constructor?.name ?? null,
      causerId: causer?.id ?? null,
      properties: { agent_id: agentId },
    })

    await emitter.emit(ESCALATED_EVENTS.TICKET_ASSIGNED, {
      ticket,
      agentId,
      causer,
    })

    return ticket.refresh()
  }

  /**
   * Unassign a ticket.
   */
  async unassign(ticket: Ticket, causer?: any): Promise<Ticket> {
    const previousAgentId = ticket.assignedTo
    ticket.assignedTo = null
    await ticket.save()

    await TicketActivity.create({
      ticketId: ticket.id,
      type: 'unassigned',
      causerType: causer?.constructor?.name ?? null,
      causerId: causer?.id ?? null,
      properties: { previous_agent_id: previousAgentId },
    })

    await emitter.emit(ESCALATED_EVENTS.TICKET_UNASSIGNED, {
      ticket,
      previousAgentId,
      causer,
    })

    return ticket.refresh()
  }

  /**
   * Auto-assign a ticket based on department agents.
   * Uses round-robin with least-assigned strategy.
   */
  async autoAssign(ticket: Ticket): Promise<Ticket | null> {
    if (!ticket.departmentId) return null

    const department = await Department.find(ticket.departmentId)
    if (!department) return null

    const { default: db } = await import('@adonisjs/lucid/services/db')
    const agentRows = await db
      .from('escalated_department_agent')
      .where('department_id', department.id)
      .select('agent_id')

    if (agentRows.length === 0) return null

    // Find the agent with least open tickets
    let bestAgentId = agentRows[0].agent_id
    let minCount = Infinity

    for (const row of agentRows) {
      const count = await Ticket.query()
        .where('assigned_to', row.agent_id)
        .whereNotIn('status', ['resolved', 'closed'])
        .count('* as total')
        .first()
      const total = Number((count as any)?.$extras?.total ?? 0)
      if (total < minCount) {
        minCount = total
        bestAgentId = row.agent_id
      }
    }

    return this.assign(ticket, bestAgentId)
  }

  /**
   * Get agent workload stats.
   */
  async getAgentWorkload(agentId: number): Promise<{
    open: number
    resolvedToday: number
    slaBreached: number
  }> {
    const { DateTime } = await import('luxon')
    const startOfDay = DateTime.now().startOf('day').toSQL()

    const openCount = await Ticket.query()
      .where('assigned_to', agentId)
      .whereNotIn('status', ['resolved', 'closed'])
      .count('* as total')
      .first()

    const resolvedCount = await Ticket.query()
      .where('assigned_to', agentId)
      .where('resolved_at', '>=', startOfDay!)
      .count('* as total')
      .first()

    const breachedCount = await Ticket.query()
      .where('assigned_to', agentId)
      .whereNotIn('status', ['resolved', 'closed'])
      .where((q) => {
        q.where('sla_first_response_breached', true)
          .orWhere('sla_resolution_breached', true)
      })
      .count('* as total')
      .first()

    return {
      open: Number((openCount as any)?.$extras?.total ?? 0),
      resolvedToday: Number((resolvedCount as any)?.$extras?.total ?? 0),
      slaBreached: Number((breachedCount as any)?.$extras?.total ?? 0),
    }
  }
}
