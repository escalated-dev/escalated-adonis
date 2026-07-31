import { DateTime } from 'luxon'
import Ticket from '../models/ticket.js'
import EscalationRule from '../models/escalation_rule.js'
import { ESCALATED_EVENTS } from '../events/index.js'
import type TicketService from './ticket_service.js'
import type AssignmentService from './assignment_service.js'
import type { TicketPriority, TicketStatus } from '../types.js'

export default class EscalationService {
  constructor(
    protected ticketService?: TicketService,
    protected assignmentService?: AssignmentService
  ) {}

  /**
   * Evaluate all active escalation rules against open tickets.
   */
  async evaluateRules(): Promise<number> {
    const rules = await this.loadActiveRules()

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
   * Load all active escalation rules, ordered by their configured priority.
   * Extracted so the runner can be exercised without a live database.
   */
  protected async loadActiveRules(): Promise<EscalationRule[]> {
    return EscalationRule.query().withScopes((scopes) => scopes.active())
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
            DateTime.now()
              .minus({ hours: Number(value) })
              .toSQL()!
          )
          break
        case 'no_response_hours':
          query.whereNull('first_response_at').where(
            'created_at',
            '<=',
            DateTime.now()
              .minus({ hours: Number(value) })
              .toSQL()!
          )
          break
        case 'sla_breached':
          query.where((q) => {
            q.where('sla_first_response_breached', true).orWhere('sla_resolution_breached', true)
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
        case 'escalate': {
          const ticketService = await this.getTicketService()
          await ticketService.changeStatus(ticket, 'escalated' as TicketStatus)
          break
        }
        case 'change_priority': {
          const ticketService = await this.getTicketService()
          await ticketService.changePriority(ticket, actionValue as TicketPriority)
          break
        }
        case 'assign_to': {
          const assignmentService = await this.getAssignmentService()
          await assignmentService.assign(ticket, Number(actionValue))
          break
        }
        case 'change_department': {
          const ticketService = await this.getTicketService()
          await ticketService.changeDepartment(ticket, Number(actionValue))
          break
        }
      }
    }

    const hasEscalate = rule.actions.some((a) => a.type === 'escalate')
    if (hasEscalate) {
      const { default: emitter } = await import('@adonisjs/core/services/emitter')
      await emitter.emit(ESCALATED_EVENTS.TICKET_ESCALATED, {
        ticket,
        reason: `Escalation rule: ${rule.name}`,
      })
    }
  }

  /**
   * Lazily resolve the ticket service. Imported on demand so the module can be
   * loaded (and unit-tested) without booting the AdonisJS container, mirroring
   * the lazy-resolution pattern used by the provider.
   */
  protected async getTicketService(): Promise<TicketService> {
    if (this.ticketService) return this.ticketService
    const { default: TicketService } = await import('./ticket_service.js')
    this.ticketService = new TicketService()
    return this.ticketService
  }

  /**
   * Lazily resolve the assignment service. See {@link getTicketService}.
   */
  protected async getAssignmentService(): Promise<AssignmentService> {
    if (this.assignmentService) return this.assignmentService
    const { default: AssignmentService } = await import('./assignment_service.js')
    this.assignmentService = new AssignmentService()
    return this.assignmentService
  }
}
