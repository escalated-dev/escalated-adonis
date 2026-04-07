import { DateTime } from 'luxon'
import Automation from '../models/automation.js'
import Ticket from '../models/ticket.js'
import Tag from '../models/tag.js'
import Reply from '../models/reply.js'
import logger from '@adonisjs/core/services/logger'

export default class AutomationRunner {
  /**
   * Evaluate all active automations against open tickets.
   */
  async run(): Promise<number> {
    const automations = await Automation.query().withScopes((scopes) => scopes.activeScope())

    let affected = 0

    for (const automation of automations) {
      const tickets = await this.findMatchingTickets(automation)

      for (const ticket of tickets) {
        await this.executeActions(automation, ticket)
        affected++
      }

      automation.lastRunAt = DateTime.now()
      await automation.save()
    }

    return affected
  }

  /**
   * Find open tickets matching the automation's conditions.
   */
  protected async findMatchingTickets(automation: Automation): Promise<Ticket[]> {
    const query = Ticket.query().whereNotIn('status', ['resolved', 'closed'])

    for (const condition of automation.conditions ?? []) {
      const field = condition.field ?? ''
      const operator = condition.operator ?? '>'
      const value = condition.value

      switch (field) {
        case 'hours_since_created': {
          const threshold = DateTime.now().minus({ hours: Number(value) })
          query.where('created_at', this.resolveOperator(operator), threshold.toSQL()!)
          break
        }

        case 'hours_since_updated': {
          const threshold = DateTime.now().minus({ hours: Number(value) })
          query.where('updated_at', this.resolveOperator(operator), threshold.toSQL()!)
          break
        }

        case 'hours_since_assigned': {
          // Approximation: use updated_at where assigned_to is set
          const threshold = DateTime.now().minus({ hours: Number(value) })
          query
            .whereNotNull('assigned_to')
            .where('updated_at', this.resolveOperator(operator), threshold.toSQL()!)
          break
        }

        case 'status':
          query.where('status', value)
          break

        case 'priority':
          query.where('priority', value)
          break

        case 'assigned':
          if (value === 'unassigned') {
            query.whereNull('assigned_to')
          } else if (value === 'assigned') {
            query.whereNotNull('assigned_to')
          }
          break

        case 'ticket_type':
          query.where('ticket_type', value)
          break

        case 'subject_contains':
          query.where('subject', 'like', `%${value}%`)
          break
      }
    }

    return query.exec()
  }

  /**
   * Execute the automation's actions on a ticket.
   */
  protected async executeActions(automation: Automation, ticket: Ticket): Promise<void> {
    for (const action of automation.actions ?? []) {
      const type = action.type ?? ''
      const value = action.value

      try {
        switch (type) {
          case 'change_status':
            ticket.status = value
            await ticket.save()
            break

          case 'assign':
            ticket.assignedTo = Number(value)
            await ticket.save()
            break

          case 'add_tag': {
            const tag = await Tag.query().where('name', value).first()
            if (tag) {
              await ticket.related('tags').sync([tag.id], false)
            }
            break
          }

          case 'change_priority':
            ticket.priority = value
            await ticket.save()
            break

          case 'add_note':
            await Reply.create({
              ticketId: ticket.id,
              body: value,
              isInternalNote: true,
              isPinned: false,
              metadata: { system_note: true, automation_id: automation.id },
            })
            break

          case 'set_ticket_type':
            if (Ticket.TYPES.includes(value as any)) {
              ticket.ticketType = value
              await ticket.save()
            }
            break
        }
      } catch (error: any) {
        logger.warn('Escalated automation action failed', {
          automation_id: automation.id,
          ticket_id: ticket.id,
          action: type,
          error: error.message,
        })
      }
    }
  }

  /**
   * Resolve a condition operator to a SQL comparison.
   * For hours_since fields, > hours means < datetime (older).
   */
  protected resolveOperator(operator: string): string {
    switch (operator) {
      case '>':
        return '<' // more hours ago = earlier datetime
      case '>=':
        return '<='
      case '<':
        return '>'
      case '<=':
        return '>='
      case '=':
        return '='
      default:
        return '<'
    }
  }
}
