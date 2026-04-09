import { DateTime } from 'luxon'
import Ticket from '../models/ticket.js'
import Tag from '../models/tag.js'
import Reply from '../models/reply.js'

interface Condition {
  field: string
  operator: string
  value: string
}

interface ConditionGroup {
  all?: Condition[]
  any?: Condition[]
}

interface Action {
  type: string
  value?: string
  url?: string
  payload?: string
  remaining_actions?: Action[]
}

export const OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'less_than',
  'greater_or_equal',
  'less_or_equal',
  'is_empty',
  'is_not_empty',
] as const

export const ACTION_TYPES = [
  'change_status',
  'assign_agent',
  'change_priority',
  'add_tag',
  'remove_tag',
  'set_department',
  'add_note',
  'send_webhook',
  'set_type',
  'delay',
  'add_follower',
  'send_notification',
] as const

export const TRIGGER_EVENTS = [
  'ticket.created',
  'ticket.updated',
  'ticket.status_changed',
  'ticket.assigned',
  'ticket.priority_changed',
  'ticket.tagged',
  'ticket.department_changed',
  'reply.created',
  'reply.agent_reply',
  'sla.warning',
  'sla.breached',
  'ticket.reopened',
] as const

export default class WorkflowEngine {
  async processEvent(eventName: string, ticket: Ticket, _context: Record<string, any> = {}) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const workflows = await db
      .from('escalated_workflows')
      .where('trigger_event', eventName)
      .where('is_active', true)
      .orderBy('position', 'asc')

    for (const workflow of workflows) {
      await this.processWorkflow(workflow, ticket, eventName)
    }
  }

  async dryRun(workflow: any, ticket: Ticket) {
    const matched = this.evaluateConditions(
      typeof workflow.conditions === 'string'
        ? JSON.parse(workflow.conditions)
        : workflow.conditions,
      ticket
    )
    const actions =
      typeof workflow.actions === 'string' ? JSON.parse(workflow.actions) : workflow.actions
    const preview = (actions || []).map((a: Action) => ({
      type: a.type,
      value: this.interpolate(String(a.value || ''), ticket),
      would_execute: matched,
    }))
    return { matched, actions: preview }
  }

  async processDelayedActions() {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const pending = await db
      .from('escalated_delayed_actions')
      .where('executed', false)
      .where('execute_at', '<=', DateTime.now().toSQL()!)

    for (const delayed of pending) {
      try {
        const ticket = await Ticket.findOrFail(delayed.ticket_id)
        const actionData =
          typeof delayed.action_data === 'string'
            ? JSON.parse(delayed.action_data)
            : delayed.action_data
        await this.executeSingleAction(actionData, ticket, delayed.workflow_id)
        await db
          .from('escalated_delayed_actions')
          .where('id', delayed.id)
          .update({ executed: true })
      } catch (e) {
        console.error(`Escalated delayed action failed: ${e}`)
      }
    }
  }

  evaluateConditions(
    conditions: ConditionGroup | Condition[] | Condition,
    ticket: Ticket
  ): boolean {
    if (Array.isArray(conditions)) {
      return conditions.every((c) => this.evalSingle(c, ticket))
    }
    if ('all' in conditions && conditions.all) {
      return conditions.all.every((c) => this.evalSingle(c, ticket))
    }
    if ('any' in conditions && conditions.any) {
      return conditions.any.some((c) => this.evalSingle(c, ticket))
    }
    if ('field' in conditions) {
      return this.evalSingle(conditions as Condition, ticket)
    }
    return false
  }

  private async processWorkflow(workflow: any, ticket: Ticket, eventName: string) {
    const conditions =
      typeof workflow.conditions === 'string'
        ? JSON.parse(workflow.conditions)
        : workflow.conditions
    const matched = this.evaluateConditions(conditions, ticket)
    if (!matched) {
      await this.logExecution(workflow.id, ticket.id, eventName, 'skipped', [])
      return
    }
    try {
      const actions =
        typeof workflow.actions === 'string' ? JSON.parse(workflow.actions) : workflow.actions
      const executed = await this.executeActions(actions || [], ticket, workflow.id)
      await this.logExecution(workflow.id, ticket.id, eventName, 'success', executed)
    } catch (e: any) {
      await this.logExecution(workflow.id, ticket.id, eventName, 'failure', [], e.message)
    }
  }

  private evalSingle(condition: Condition, ticket: Ticket): boolean {
    const field = condition.field
    const operator = condition.operator || 'equals'
    const expected = condition.value
    const actual = this.resolveField(field, ticket)
    return this.applyOperator(operator, actual, expected)
  }

  private resolveField(field: string, ticket: Ticket): any {
    const map: Record<string, any> = {
      status: ticket.status,
      priority: ticket.priority,
      assigned_to: ticket.assignedTo,
      department_id: ticket.departmentId,
      channel: (ticket as any).channel,
      ticket_type: ticket.ticketType,
      subject: ticket.subject,
      description: ticket.description,
    }
    if (field === 'hours_since_created') {
      return (
        Math.round(
          DateTime.now().diff(DateTime.fromJSDate(ticket.createdAt as any), 'hours').hours * 10
        ) / 10
      )
    }
    if (field === 'hours_since_updated') {
      return (
        Math.round(
          DateTime.now().diff(DateTime.fromJSDate(ticket.updatedAt as any), 'hours').hours * 10
        ) / 10
      )
    }
    return map[field]
  }

  private applyOperator(operator: string, actual: any, expected: any): boolean {
    const actualS = String(actual ?? '')
    const expectedS = String(expected ?? '')
    switch (operator) {
      case 'equals':
        return actualS === expectedS
      case 'not_equals':
        return actualS !== expectedS
      case 'contains':
        return actualS.includes(expectedS)
      case 'not_contains':
        return !actualS.includes(expectedS)
      case 'starts_with':
        return actualS.startsWith(expectedS)
      case 'ends_with':
        return actualS.endsWith(expectedS)
      case 'greater_than':
        return Number(actual) > Number(expected)
      case 'less_than':
        return Number(actual) < Number(expected)
      case 'greater_or_equal':
        return Number(actual) >= Number(expected)
      case 'less_or_equal':
        return Number(actual) <= Number(expected)
      case 'is_empty':
        return !actualS.trim()
      case 'is_not_empty':
        return !!actualS.trim()
      default:
        return false
    }
  }

  private async executeActions(actions: Action[], ticket: Ticket, workflowId: number) {
    const executed = []
    for (const action of actions) {
      const result = await this.executeSingleAction(action, ticket, workflowId)
      executed.push({ type: action.type, result })
    }
    return executed
  }

  private async executeSingleAction(
    action: Action,
    ticket: Ticket,
    workflowId: number
  ): Promise<string> {
    try {
      switch (action.type) {
        case 'change_status':
          ticket.status = action.value as any
          await ticket.save()
          break
        case 'assign_agent':
          ticket.assignedTo = Number(action.value)
          await ticket.save()
          break
        case 'change_priority':
          ticket.priority = action.value as any
          await ticket.save()
          break
        case 'add_tag': {
          const tag = await Tag.firstOrCreate({ name: action.value! })
          await ticket.related('tags').attach([tag.id])
          break
        }
        case 'remove_tag': {
          const tagToRemove = await Tag.findBy('name', action.value)
          if (tagToRemove) await ticket.related('tags').detach([tagToRemove.id])
          break
        }
        case 'set_department':
          ticket.departmentId = Number(action.value)
          await ticket.save()
          break
        case 'add_note':
          await Reply.create({
            ticketId: ticket.id,
            body: this.interpolate(String(action.value || ''), ticket),
            isInternalNote: true,
          })
          break
        case 'send_webhook':
          await this.sendWebhook(action, ticket)
          break
        case 'set_type':
          ticket.ticketType = action.value!
          await ticket.save()
          break
        case 'delay': {
          const { default: db } = await import('@adonisjs/lucid/services/db')
          const delayMinutes = Number(action.value || 0)
          for (const remaining of action.remaining_actions || []) {
            await db.table('escalated_delayed_actions').insert({
              workflow_id: workflowId,
              ticket_id: ticket.id,
              action_data: JSON.stringify(remaining),
              execute_at: DateTime.now().plus({ minutes: delayMinutes }).toSQL(),
              executed: false,
              created_at: DateTime.now().toSQL(),
            })
          }
          return 'delayed'
        }
        case 'add_follower':
          await ticket.related('followers' as any).attach([Number(action.value)])
          break
        case 'send_notification':
          console.log(
            `Workflow notification: ${this.interpolate(String(action.value || ''), ticket)}`
          )
          break
      }
      return 'executed'
    } catch (e: any) {
      console.warn(`Workflow action ${action.type} failed: ${e.message}`)
      return 'failed'
    }
  }

  private async sendWebhook(action: Action, ticket: Ticket) {
    const url = action.url || action.value!
    const body = JSON.stringify({
      event: 'workflow_action',
      ticket: {
        id: ticket.id,
        reference: ticket.reference,
        subject: ticket.subject,
        status: ticket.status,
      },
      payload: action.payload ? this.interpolate(action.payload, ticket) : null,
    })
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10000),
    })
  }

  private interpolate(text: string, ticket: Ticket): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
      const map: Record<string, string> = {
        ticket_id: String(ticket.id),
        ticket_ref: ticket.reference,
        reference: ticket.reference,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
      }
      return map[varName] ?? `{{${varName}}}`
    })
  }

  private async logExecution(
    workflowId: number,
    ticketId: number,
    triggerEvent: string,
    status: string,
    actionsExecuted: any[],
    errorMessage?: string
  ) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    await db.table('escalated_workflow_logs').insert({
      workflow_id: workflowId,
      ticket_id: ticketId,
      trigger_event: triggerEvent,
      status,
      actions_executed: JSON.stringify(actionsExecuted),
      error_message: errorMessage || null,
      created_at: DateTime.now().toSQL(),
    })
  }
}
