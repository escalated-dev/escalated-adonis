import type { HttpContext } from '@adonisjs/core/http'
import { getRenderer } from '../rendering/renderer.js'
import WorkflowEngine, {
  OPERATORS,
  ACTION_TYPES,
  TRIGGER_EVENTS,
} from '../services/workflow_engine.js'
import Ticket from '../models/ticket.js'

export default class AdminWorkflowsController {
  async index(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const workflows = await db
      .from('escalated_workflows')
      .orderBy('position', 'asc')
      .orderBy('name', 'asc')
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Index', { workflows })
  }

  async show(ctx: HttpContext) {
    const { default: db } = await import('@adonisjs/lucid/services/db')
    const workflow = await db.from('escalated_workflows').where('id', ctx.params.id).firstOrFail()
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Show', {
      workflow,
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
      .where('workflow_id', ctx.params.id)
      .orderBy('created_at', 'desc')
      .limit(100)
    return getRenderer().render(ctx, 'Escalated/Admin/Workflows/Logs', { workflow, logs })
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
