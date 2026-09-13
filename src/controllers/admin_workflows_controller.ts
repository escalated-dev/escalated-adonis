import type { HttpContext } from '@adonisjs/core/http'
import { escalatedDb } from '../helpers/config.js'
import { getRenderer } from '../rendering/renderer.js'
import { redirectToRoute } from '../support/routing.js'
import { t } from '../support/i18n.js'
import WorkflowEngine, {
  OPERATORS,
  ACTION_TYPES,
  TRIGGER_EVENTS,
} from '../services/workflow_engine.js'
import Ticket from '../models/ticket.js'
import {
  validateWorkflowPayload,
  type WorkflowValidationMessage,
} from '../validators/admin/workflow_payload.js'

/*
|--------------------------------------------------------------------------
| Admin workflows
|--------------------------------------------------------------------------
|
| Page props, the create/update body, and toggle/reorder/delete follow
| escalated-developer-context/domain-model/workflow-admin-contract.md.
|
*/

const INDEX_ROUTE = 'escalated.admin.workflows.index'

function workflowJson(row: Record<string, any>) {
  return {
    ...row,
    trigger: row.trigger_event,
    conditions: typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions,
    actions: typeof row.actions === 'string' ? JSON.parse(row.actions) : row.actions,
    // MySQL and SQLite hand booleans back as 1 and 0.
    is_active: Boolean(row.is_active),
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

function formOptions() {
  return {
    trigger_events: TRIGGER_EVENTS,
    action_types: ACTION_TYPES,
    operators: OPERATORS,
  }
}

/**
 * An Inertia form visit cannot consume a JSON 422. Flash the errors under the
 * keys a VineJS validation failure uses, which the Inertia adapter reads into
 * the page's `errors`, and send the visit back to the form.
 */
function redirectBackWithErrors(ctx: HttpContext, messages: WorkflowValidationMessage[]) {
  ctx.session.flashValidationErrors({ code: 'E_VALIDATION_ERROR', messages } as any)
  return ctx.response.redirect().back()
}

export default class AdminWorkflowsController {
  async index(ctx: HttpContext) {
    const db = await escalatedDb()
    const workflows = await db
      .from('escalated_workflows')
      .orderBy('position', 'asc')
      .orderBy('name', 'asc')
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Index', {
      workflows: workflows.map(workflowJson),
    })
  }

  async create(ctx: HttpContext) {
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Form', {
      workflow: null,
      ...formOptions(),
    })
  }

  async store(ctx: HttpContext) {
    const result = validateWorkflowPayload(ctx.request.all())
    if (!result.ok) return redirectBackWithErrors(ctx, result.messages)

    const db = await escalatedDb()
    const last = await db.from('escalated_workflows').max('position as max_position').first()
    const now = new Date()

    await db.table('escalated_workflows').insert({
      name: result.data.name,
      trigger_event: result.data.trigger_event,
      conditions: JSON.stringify(result.data.conditions),
      actions: JSON.stringify(result.data.actions),
      is_active: result.data.is_active,
      position: Number(last?.max_position ?? -1) + 1,
      created_at: now,
      updated_at: now,
    })

    ctx.session.flash('success', t('admin.workflow_created'))
    return redirectToRoute(ctx.response, INDEX_ROUTE)
  }

  async edit(ctx: HttpContext) {
    const db = await escalatedDb()
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Form', {
      workflow: workflowJson(workflow),
      ...formOptions(),
    })
  }

  async update(ctx: HttpContext) {
    const db = await escalatedDb()
    await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()

    const result = validateWorkflowPayload(ctx.request.all())
    if (!result.ok) return redirectBackWithErrors(ctx, result.messages)

    await db
      .from('escalated_workflows')
      .where('id', ctx.params.id)
      .update({
        name: result.data.name,
        trigger_event: result.data.trigger_event,
        conditions: JSON.stringify(result.data.conditions),
        actions: JSON.stringify(result.data.actions),
        is_active: result.data.is_active,
        updated_at: new Date(),
      })

    ctx.session.flash('success', t('admin.workflow_updated'))
    return redirectToRoute(ctx.response, INDEX_ROUTE)
  }

  async destroy(ctx: HttpContext) {
    const db = await escalatedDb()
    await db.from('escalated_workflows').where('id', ctx.params.id).delete()
    ctx.session.flash('success', t('admin.workflow_deleted'))
    return redirectToRoute(ctx.response, INDEX_ROUTE)
  }

  async toggle(ctx: HttpContext) {
    const db = await escalatedDb()
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    await db
      .from('escalated_workflows')
      .where('id', ctx.params.id)
      .update({ is_active: !workflow.is_active, updated_at: new Date() })
    return redirectToRoute(ctx.response, INDEX_ROUTE)
  }

  async reorder(ctx: HttpContext) {
    const db = await escalatedDb()
    const ids = ctx.request.input('workflow_ids', [])
    if (Array.isArray(ids)) {
      for (const [position, id] of ids.entries()) {
        await db.from('escalated_workflows').where('id', id).update({ position })
      }
    }
    return redirectToRoute(ctx.response, INDEX_ROUTE)
  }

  async logs(ctx: HttpContext) {
    const db = await escalatedDb()
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    const logs = await db
      .from('escalated_workflow_logs')
      .leftJoin(
        'escalated_workflows',
        'escalated_workflow_logs.workflow_id',
        'escalated_workflows.id'
      )
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
    const db = await escalatedDb()
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    const ticketId = ctx.request.input('ticket_id')
    const ticket = await Ticket.findOrFail(ticketId)
    const engine = new WorkflowEngine()
    const result = await engine.dryRun(workflow, ticket)
    return ctx.response.ok(result)
  }
}
