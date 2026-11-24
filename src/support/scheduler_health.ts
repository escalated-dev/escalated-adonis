/*
|--------------------------------------------------------------------------
| Scheduler health
|--------------------------------------------------------------------------
|
| SLA checks, escalation rules, automations and snooze wake-ups only happen
| when the host runs their Ace commands on a schedule (cron, a process
| manager or a scheduler package). AdonisJS has no in-process scheduler for
| the package to register with, so an install that never schedules them
| silently never breaches an SLA.
|
| `escalated:check-sla` records a heartbeat (the `scheduler_sla_check_last_run_at`
| setting) every time it runs. The admin Settings and Reports pages get a
| `scheduler` prop built from it; the shared frontend shows a warning while
| `healthy` is false (heartbeat missing or older than 15 minutes), with the
| message and the commands to schedule. `node ace escalated:doctor` reports
| the same.
|
*/

import { DateTime } from 'luxon'

/** The setting the SLA check's heartbeat is kept in (an ISO 8601 timestamp). */
export const SCHEDULER_HEARTBEAT_SETTING = 'scheduler_sla_check_last_run_at'

/** A heartbeat older than this means the recurring jobs are not running. */
export const SCHEDULER_STALE_AFTER_MINUTES = 15

/** The recurring commands a host must schedule, and how often. */
export const REQUIRED_SCHEDULED_COMMANDS: ReadonlyArray<{ command: string; interval: string }> = [
  { command: 'node ace escalated:check-sla', interval: 'every minute' },
  { command: 'node ace escalated:wake-snoozed-tickets', interval: 'every minute' },
  { command: 'node ace escalated:run-escalations', interval: 'every 5 minutes' },
  { command: 'node ace escalated:run-automations', interval: 'every 5 minutes' },
]

/** The `scheduler` page prop (shared contract with the frontend and every backend). */
export interface SchedulerStatus {
  healthy: boolean
  last_run_at: string | null
  message: string
  commands: Array<{ command: string; interval: string }>
}

/** Builds the status from the last heartbeat. Pure, for tests. */
export function describeScheduler(
  lastRunAt: DateTime | null,
  now: DateTime = DateTime.now()
): SchedulerStatus {
  const commands = REQUIRED_SCHEDULED_COMMANDS.map((entry) => ({ ...entry }))
  const valid = lastRunAt && lastRunAt.isValid ? lastRunAt : null

  if (!valid) {
    return {
      healthy: false,
      last_run_at: null,
      message:
        "Escalated's recurring jobs are not running: escalated:check-sla has never run, so SLA " +
        'breaches, escalation rules, automations and snooze wake-ups do not happen. Schedule ' +
        'these commands with cron or your process manager.',
      commands,
    }
  }

  const ageMinutes = now.diff(valid, 'minutes').minutes
  const lastRun = valid.toUTC().toISO()

  if (ageMinutes > SCHEDULER_STALE_AFTER_MINUTES) {
    return {
      healthy: false,
      last_run_at: lastRun,
      message:
        `Escalated's recurring jobs are not running: escalated:check-sla last ran at ${lastRun}, ` +
        `more than ${SCHEDULER_STALE_AFTER_MINUTES} minutes ago. SLA breaches, escalation rules, ` +
        'automations and snooze wake-ups are not happening. Schedule these commands with cron or ' +
        'your process manager.',
      commands,
    }
  }

  return {
    healthy: true,
    last_run_at: lastRun,
    message: `Escalated's recurring jobs are running: escalated:check-sla last ran at ${lastRun}.`,
    commands,
  }
}

async function settings() {
  const { default: EscalatedSetting } = await import('../models/escalated_setting.js')
  return EscalatedSetting
}

/** Records that the SLA check ran now. */
export async function recordSlaCheckHeartbeat(now: DateTime = DateTime.now()): Promise<void> {
  const EscalatedSetting = await settings()
  await EscalatedSetting.set(SCHEDULER_HEARTBEAT_SETTING, now.toUTC().toISO()!)
}

/** The scheduler status from the stored heartbeat. */
export async function schedulerStatus(now: DateTime = DateTime.now()): Promise<SchedulerStatus> {
  const EscalatedSetting = await settings()
  const stored = await EscalatedSetting.get(SCHEDULER_HEARTBEAT_SETTING)
  const lastRunAt = stored ? DateTime.fromISO(stored) : null
  return describeScheduler(lastRunAt, now)
}

/**
 * The status for an admin page, or null when it cannot be read (the
 * contract's "cannot tell"), so a settings table problem never breaks the
 * page itself.
 */
export async function schedulerStatusProp(): Promise<SchedulerStatus | null> {
  try {
    return await schedulerStatus()
  } catch {
    return null
  }
}
