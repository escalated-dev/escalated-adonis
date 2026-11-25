/*
|--------------------------------------------------------------------------
| Setup checks (`node ace escalated:doctor`)
|--------------------------------------------------------------------------
|
| What an install needs before staff can use Escalated, checked in one place:
|
|   staff gates     authorization.isAgent / isAdmin in config/escalated.ts
|   user model      config.userModel resolves to a model whose users have an
|                   `id` (EscalatedAuthUser, src/support/auth_user.ts)
|   recurring jobs  the escalated:check-sla heartbeat is fresh
|                   (src/support/scheduler_health.ts)
|
| Missing gates or an unusable user model are errors; recurring jobs that are
| not scheduled yet are a warning.
|
*/

import { missingStaffGates, missingStaffGatesMessage } from './staff_gates.js'
import { resolveUserModel } from './user_model.js'
import { schedulerStatus, type SchedulerStatus } from './scheduler_health.js'

export type SetupCheckStatus = 'ok' | 'warning' | 'error'

export interface SetupCheck {
  name: 'staff_gates' | 'user_model' | 'recurring_jobs'
  status: SetupCheckStatus
  message: string
}

export interface SetupReport {
  ok: boolean
  checks: SetupCheck[]
  scheduler: SchedulerStatus | null
}

export function checkStaffGates(): SetupCheck {
  const missing = missingStaffGates()
  if (missing.length === 0) {
    return {
      name: 'staff_gates',
      status: 'ok',
      message: 'authorization.isAgent and authorization.isAdmin are configured.',
    }
  }
  return { name: 'staff_gates', status: 'error', message: missingStaffGatesMessage(missing) }
}

/**
 * Whether users of `model` have an `id`: a Lucid model with `id` as its
 * primary key or a column, or any other class (which cannot be inspected and
 * is trusted).
 */
function modelHasId(model: any): boolean {
  if (typeof model.$hasColumn !== 'function') return true
  if (typeof model.boot === 'function') model.boot()
  return model.primaryKey === 'id' || model.$hasColumn('id')
}

export async function checkUserModel(
  resolve: () => Promise<any> = () => resolveUserModel()
): Promise<SetupCheck> {
  let model: any
  try {
    model = await resolve()
  } catch (error) {
    return { name: 'user_model', status: 'error', message: (error as Error).message }
  }

  if (!modelHasId(model)) {
    return {
      name: 'user_model',
      status: 'error',
      message:
        `Escalated: config.userModel resolved to ${model.name}, which has no \`id\` column or ` +
        `primary key. Signed-in users must implement EscalatedAuthUser ` +
        `(@escalated-dev/escalated-adonis/support/auth_user): an \`id\` (number, or string with ` +
        `ESCALATED_USER_KEY_TYPE=uuid|string). Add an \`id\` column or point config.userModel ` +
        `at the model your auth guard signs in.`,
    }
  }

  return {
    name: 'user_model',
    status: 'ok',
    message: `config.userModel resolves to ${model.name}, with an \`id\`.`,
  }
}

export async function checkRecurringJobs(
  read: () => Promise<SchedulerStatus> = () => schedulerStatus()
): Promise<{ check: SetupCheck; scheduler: SchedulerStatus | null }> {
  let scheduler: SchedulerStatus
  try {
    scheduler = await read()
  } catch (error) {
    return {
      check: {
        name: 'recurring_jobs',
        status: 'warning',
        message: `Could not read the escalated:check-sla heartbeat: ${(error as Error).message}`,
      },
      scheduler: null,
    }
  }

  const list = scheduler.commands.map((c) => `${c.command} (${c.interval})`).join('; ')
  return {
    check: {
      name: 'recurring_jobs',
      status: scheduler.healthy ? 'ok' : 'warning',
      message: scheduler.healthy ? scheduler.message : `${scheduler.message} Schedule: ${list}.`,
    },
    scheduler,
  }
}

export async function runSetupChecks(): Promise<SetupReport> {
  const { check: recurring, scheduler } = await checkRecurringJobs()
  const checks = [checkStaffGates(), await checkUserModel(), recurring]
  return { ok: checks.every((check) => check.status !== 'error'), checks, scheduler }
}
