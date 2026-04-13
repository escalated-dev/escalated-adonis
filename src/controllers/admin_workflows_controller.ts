import type { HttpContext } from '@adonisjs/core/http'
import { getRenderer } from '../rendering/renderer.js'
import WorkflowEngine, {
  OPERATORS,
  ACTION_TYPES,
  TRIGGER_EVENTS,
} from '../services/workflow_engine.js'
import Ticket from '../models/ticket.js'

function workflowJson(row: Record<string, any>) {
  return {
    ...row,
    trigger: row.trigger_event,
    conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
    actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
  }
}

function logJson(row: Record<string, any>) {
  const rawActions =
    typeof row.actions_executed === 'string'
      ? JSON.parse(row.actions_executed || '[]')
      : row.actions_executed || []
  const startedAt = row.started_at ? new Date(row.started_at).getTime() : null
  const completedAt = row.completed_at ? new Date(row.completed_at).getTime() : null

  return {
    id: row.id,
    workflow_id: row.workflow_id,
    ticket_id: row.ticket_id,
    trigger_event: row.trigger_event,
    event: row.trigger_event,
    workflow_name: row.workflow_name ?? null,
    ticket_reference: row.ticket_reference ?? null,
    matched: !!row.conditions_matched,
    actions_executed: Array.isArray(rawActions) ? rawActions.length : 0,
    action_details: rawActions,
    duration_ms: startedAt && completedAt ? completedAt - startedAt : null,
    status: row.error_message ? 'failed' : 'success',
    error_message: row.error_message,
    created_at: row.created_at,
  }
}

export default class AdminWorkflowsController {
  async index(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const workflows = await db
      .from('escalated_workflows')
      .orderBy('position', 'asc')
      .orderBy('name', 'asc')
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Index', {
      workflows: workflows.map(workflowJson),
    })
  }

  async show(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Show', {
      workflow: workflowJson(workflow),
      trigger_events: TRIGGER_EVENTS,
      operators: OPERATORS,
      action_types: ACTION_TYPES,
    })
  }

  async store(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const data = ctx.request.only([
      'name',
      'trigger_event',
      'conditions',
      'actions',
      'is_active',
      'position',
    ])
    const [id] = await db.table('escalated_workflows').insert({
      ...data,
      conditions: JSON.stringify(data.conditions || {}),
      actions: JSON.stringify(data.actions || []),
    })
    return ctx.response.created({ id })
  }

  async update(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const data = ctx.request.only([
      'name',
      'trigger_event',
      'conditions',
      'actions',
      'is_active',
      'position',
    ])
    if (data.conditions) data.conditions = JSON.stringify(data.conditions)
    if (data.actions) data.actions = JSON.stringify(data.actions)
    await db.from('escalated_workflows').where('id', ctx.params.id).update(data)
    return ctx.response.ok({ updated: true })
  }

  async destroy(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    await db.from('escalated_workflows').where('id', ctx.params.id).delete()
    return ctx.response.ok({ deleted: true })
  }

  async toggle(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    await db
      .from('escalated_workflows')
      .where('id', ctx.params.id)
      .update({ is_active: !workflow.is_active })
    return ctx.response.ok({ is_active: !workflow.is_active })
  }

  async reorder(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const ids = ctx.request.input('workflow_ids', [])
    for (const [i, id] of ids.entries()) {
      await db.from('escalated_workflows').where('id', id).update({ position: i })
    }
    return ctx.response.ok({ reordered: true })
  }

  async logs(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    const logs = await db
      .from('escalated_workflow_logs')
      .leftJoin('escalated_workflows', 'escalated_workflow_logs.workflow_id', 'escalated_workflows.id')
      .leftJoin('escalated_tickets', 'escalated_workflow_logs.ticket_id', 'escalated_tickets.id')
      .select(
        'escalated_workflow_logs.*',
        'escalated_workflows.name as workflow_name',
        'escalated_tickets.reference as ticket_reference'
      )
      .where('escalated_workflow_logs.workflow_id', ctx.params.id)
      .orderBy('escalated_workflow_logs.created_at', 'desc')
      .limit(100)
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Logs', {
      workflow: workflowJson(workflow),
      logs: logs.map(logJson),
    })
  }

  async dryRun(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    const ticketId = ctx.request.input('ticket_id')
    const ticket = await Ticket.findOrFail(ticketId)
    const engine = new WorkflowEngine()
    const result = await engine.dryRun(workflow, ticket)
    return ctx.response.ok(result)
  }
}
