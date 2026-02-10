import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import Ticket from '../models/ticket.js'
import EscalationRule from '../models/escalation_rule.js'
import TicketService from './ticket_service.js'
import AssignmentService from './assignment_service.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import type { TicketPriority, TicketStatus } from '../types.js'

export default class EscalationService {
  constructor(
    protected ticketService: TicketService = new TicketService(),
    protected assignmentService: AssignmentService = new AssignmentService()
  ) {}

  /**
   * Evaluate all active escalation rules against open tickets.
   */
  async evaluateRules(): Promise<number> {
    const rules = await EscalationRule.query()
      .withScopes((scopes) => scopes.active())

    let escalated = 0

    for (const rule of rules) {
      const tickets = await this.findMatchingTickets(rule)

      for (const ticket of tickets) {
        await this.executeActions(ticket, rule)
        escalated++
      }
    }

    return escalated
  }

  /**
   * Find tickets matching a rule's conditions.
   */
  protected async findMatchingTickets(rule: EscalationRule): Promise<Ticket[]> {
    const query = Ticket.query().whereNotIn('status', ['resolved', 'closed'])

    for (const condition of rule.conditions) {
      const field = condition.field ?? ''
      const value = condition.value

      switch (field) {
        case 'status':
          query.where('status', value)
          break
        case 'priority':
          query.where('priority', value)
          break
        case 'assigned':
          if (value === 'unassigned') {
            query.whereNull('assigned_to')
          } else {
            query.whereNotNull('assigned_to')
          }
          break
        case 'age_hours':
          query.where(
            'created_at',
            '<=',
            DateTime.now().minus({ hours: Number(value) }).toSQL()!
          )
          break
        case 'no_response_hours':
          query
            .whereNull('first_response_at')
            .where(
              'created_at',
              '<=',
              DateTime.now().minus({ hours: Number(value) }).toSQL()!
            )
          break
        case 'sla_breached':
          query.where((q) => {
            q.where('sla_first_response_breached', true)
              .orWhere('sla_resolution_breached', true)
          })
          break
        case 'department_id':
          query.where('department_id', value)
          break
      }
    }

    return query.exec()
  }

  /**
   * Execute actions from an escalation rule on a ticket.
   */
  protected async executeActions(ticket: Ticket, rule: EscalationRule): Promise<void> {
    for (const action of rule.actions) {
      const actionType = action.type ?? ''
      const actionValue = action.value

      switch (actionType) {
        case 'escalate':
          await this.ticketService.changeStatus(ticket, 'escalated' as TicketStatus)
          break
        case 'change_priority':
          await this.ticketService.changePriority(ticket, actionValue as TicketPriority)
          break
        case 'assign_to':
          await this.assignmentService.assign(ticket, Number(actionValue))
          break
        case 'change_department':
          await this.ticketService.changeDepartment(ticket, Number(actionValue))
          break
      }
    }

    const hasEscalate = rule.actions.some((a) => a.type === 'escalate')
    if (hasEscalate) {
      await emitter.emit(ESCALATED_EVENTS.TICKET_ESCALATED, {
        ticket,
        reason: `Escalation rule: ${rule.name}`,
      })
    }
  }
}
