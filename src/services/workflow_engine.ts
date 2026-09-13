import { DateTime } from 'luxon'
import Ticket from '../models/ticket.js'
import Tag from '../models/tag.js'
import Reply from '../models/reply.js'
import { allowPrivateWebhookUrls, escalatedDb } from '../helpers/config.js'
import { assertPublicHttpUrl } from '../support/outbound_url.js'
import { ESCALATED_EVENTS } from '../events/index.js'

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

/**
 * The actions offered to the admin builder: the ones the executor below carries
 * out from what the builder sends.
 *
 * `delay` and `send_notification` still execute for workflows that already hold
 * them, but are not offered. A builder `delay` is `{type, value}` with no
 * actions to defer, and nothing runs the delayed-action queue; a
 * `send_notification` only writes to the console.
 */
export const ACTION_TYPES = [
  'change_status',
  'assign_agent',
  'change_priority',
  'add_tag',
  'remove_tag',
  'set_department',
  'add_note',
  'insert_canned_reply',
  'send_webhook',
  'set_type',
  'add_follower',
] as const

/**
 * The package events that run workflows, keyed by emitter event name: the five
 * Workflow triggers in the domain model. The provider subscribes the engine to
 * exactly these, and `TRIGGER_EVENTS` is derived from them, so the builder only
 * offers triggers that fire.
 */
export const WORKFLOW_TRIGGER_EVENT_MAP = {
  [ESCALATED_EVENTS.TICKET_CREATED]: 'ticket.created',
  [ESCALATED_EVENTS.TICKET_UPDATED]: 'ticket.updated',
  [ESCALATED_EVENTS.TICKET_ASSIGNED]: 'ticket.assigned',
  [ESCALATED_EVENTS.TICKET_STATUS_CHANGED]: 'ticket.status_changed',
  [ESCALATED_EVENTS.REPLY_CREATED]: 'reply.created',
} as const

export const TRIGGER_EVENTS = Object.values(WORKFLOW_TRIGGER_EVENT_MAP)

export default class WorkflowEngine {
  async processEvent(eventName: string, ticket: Ticket, _context: Record<string, any> = {}) {
    const db = await escalatedDb()
    const workflows = await db
      .from('escalated_workflows')
      .where('trigger_event', eventName)
      .where('is_active', true)
      .orderBy('position', 'asc')

    for (const workflow of workflows) {
      await this.processWorkflow(workflow, ticket, eventName)
    }
  }

  /**
   * Run the workflows for a trigger, given the emitter's event data: a ticket
   * event carries the ticket, a reply event carries the reply.
   *
   * Never throws. A failing workflow must not break the ticket change that
   * emitted the event.
   */
  async handleEvent(triggerEvent: string, data: { ticket?: Ticket; reply?: { ticketId: number } }) {
    try {
      const ticket = data?.ticket ?? (data?.reply ? await Ticket.find(data.reply.ticketId) : null)
      if (!ticket) return
      await this.processEvent(triggerEvent, ticket)
    } catch (error) {
      console.warn(`[Escalated] workflows for ${triggerEvent} failed:`, (error as Error).message)
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
    const db = await escalatedDb()
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
    conditions: ConditionGroup | Condition[] | Condition | null | undefined,
    ticket: Ticket
  ): boolean {
    // Omitted conditions mean every ticket. So does `{}`, which is what this
    // package stored for omitted conditions before they defaulted to `{all: []}`.
    if (conditions === null || conditions === undefined) {
      return true
    }
    // A flat list is an older stored shape, read as `all`.
    if (Array.isArray(conditions)) {
      return conditions.every((c) => this.evalSingle(c, ticket))
    }
    if ('all' in conditions && Array.isArray(conditions.all)) {
      return conditions.all.every((c) => this.evalSingle(c, ticket))
    }
    if ('any' in conditions && Array.isArray(conditions.any)) {
      // An empty list matches every ticket, for `any` as well as `all`.
      return conditions.any.length === 0 || conditions.any.some((c) => this.evalSingle(c, ticket))
    }
    if ('field' in conditions) {
      return this.evalSingle(conditions as Condition, ticket)
    }
    return Object.keys(conditions).length === 0
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
          ticket.assignedTo = action.value as string | number
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
            isPinned: false,
            type: 'note',
          })
          break
        case 'insert_canned_reply':
          await Reply.create({
            ticketId: ticket.id,
            body: this.interpolate(String(action.value || ''), ticket),
            isInternalNote: false,
            isPinned: false,
            type: 'reply',
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
          const db = await escalatedDb()
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
          await ticket.follow(action.value as string | number)
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
    // Checked on every send, like admin webhooks. A refused URL throws, and the
    // action is recorded as failed.
    await assertPublicHttpUrl(url, { allowPrivate: allowPrivateWebhookUrls() })
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
      redirect: 'manual',
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
    const db = await escalatedDb()
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
