import { TRIGGER_EVENTS } from '../../services/workflow_engine.js'

/**
 * Validates the create/update body the shared admin UI sends for a Workflow.
 *
 * The wire format is fixed in
 * `escalated-developer-context/domain-model/workflow-admin-contract.md`:
 * top-level `name`, `trigger_event`, `conditions` and `actions` keys, with
 * conditions as `{all: [...]}` or `{any: [...]}` and actions as `{type, value}`.
 */

export interface WorkflowCondition {
  field: string
  operator: string
  value?: unknown
}

export type WorkflowConditions = { all: WorkflowCondition[] } | { any: WorkflowCondition[] }

export interface WorkflowAction {
  type: string
  value?: unknown
  [key: string]: unknown
}

export interface WorkflowPayload {
  name: string
  trigger_event: string
  conditions: WorkflowConditions
  actions: WorkflowAction[]
  is_active: boolean
}

/** One failed rule, in the shape Adonis flashes validation errors from. */
export interface WorkflowValidationMessage {
  field: string
  message: string
}

export type WorkflowPayloadResult =
  { ok: true; data: WorkflowPayload } | { ok: false; messages: WorkflowValidationMessage[] }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function validConditionList(list: unknown): list is WorkflowCondition[] {
  return (
    Array.isArray(list) &&
    list.every(
      (condition) =>
        isPlainObject(condition) &&
        isNonEmptyString(condition.field) &&
        isNonEmptyString(condition.operator) &&
        (condition.value === undefined || isScalar(condition.value))
    )
  )
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') return !['false', '0', ''].includes(value.toLowerCase())
  return Boolean(value)
}

export function validateWorkflowPayload(input: Record<string, unknown>): WorkflowPayloadResult {
  const messages: WorkflowValidationMessage[] = []
  const fail = (field: string, message: string) => messages.push({ field, message })

  const name = input.name
  if (!isNonEmptyString(name)) {
    fail('name', 'Give the workflow a name.')
  } else if (name.trim().length > 255) {
    fail('name', 'The name may be at most 255 characters.')
  }

  const triggerEvent = input.trigger_event
  if (!isNonEmptyString(triggerEvent)) {
    fail('trigger_event', 'Choose the event that triggers this workflow.')
  } else if (!(TRIGGER_EVENTS as readonly string[]).includes(triggerEvent)) {
    fail('trigger_event', `"${triggerEvent}" is not an event this backend fires.`)
  }

  // Omitted conditions mean "every ticket".
  let conditions: WorkflowConditions = { all: [] }
  if (input.conditions !== undefined && input.conditions !== null) {
    const keys = isPlainObject(input.conditions) ? Object.keys(input.conditions) : []
    const group = keys.length === 1 && (keys[0] === 'all' || keys[0] === 'any') ? keys[0] : null
    const list = group ? (input.conditions as Record<string, unknown>)[group] : undefined

    if (!group) {
      fail('conditions', 'Conditions must be grouped under exactly one of "all" or "any".')
    } else if (!validConditionList(list)) {
      fail('conditions', 'Every condition needs a field and an operator, and a single value.')
    } else {
      conditions = group === 'all' ? { all: list } : { any: list }
    }
  }

  const actions = input.actions
  if (!Array.isArray(actions) || actions.length === 0) {
    fail('actions', 'Add at least one action.')
  } else if (
    !actions.every(
      (action) =>
        isPlainObject(action) &&
        isNonEmptyString(action.type) &&
        (action.value === undefined || isScalar(action.value))
    )
  ) {
    fail('actions', 'Every action needs a type, and a single value.')
  }

  if (messages.length > 0) {
    return { ok: false, messages }
  }

  return {
    ok: true,
    data: {
      name: (name as string).trim(),
      trigger_event: triggerEvent as string,
      conditions,
      actions: actions as WorkflowAction[],
      is_active: readBoolean(input.is_active, true),
    },
  }
}
