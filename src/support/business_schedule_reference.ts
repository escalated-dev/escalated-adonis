import BusinessSchedule from '../models/business_schedule.js'

/**
 * The `business_schedule_id` an SLA policy or department save sets, only when
 * the request sends the key, so a form that does not know about schedules
 * never clears one. An empty value clears it; an id that names no schedule is
 * a field error (escalated-laravel's `exists` rule).
 */
export async function scheduleReference(
  input: Record<string, any>
): Promise<{ businessScheduleId?: number | null } | { errors: Record<string, string> }> {
  if (!Object.prototype.hasOwnProperty.call(input, 'business_schedule_id')) return {}

  const value = input.business_schedule_id
  if (value === null || value === undefined || value === '') {
    return { businessScheduleId: null }
  }

  const id = Number(value)
  const schedule = Number.isInteger(id) && id > 0 ? await BusinessSchedule.find(id) : null
  if (!schedule) {
    return { errors: { business_schedule_id: 'The selected business schedule is invalid.' } }
  }
  return { businessScheduleId: schedule.id }
}

/**
 * The SLA policy and department forms' `schedules` prop: every business
 * schedule as `{id, name}`, by name, for the shared Business hours schedule
 * picker (escalated-laravel passes
 * `BusinessSchedule::orderBy('name')->get(['id', 'name'])`).
 */
export async function scheduleOptions(): Promise<Array<{ id: number; name: string }>> {
  const rows = await BusinessSchedule.query().select('id', 'name').orderBy('name').orderBy('id')
  return rows.map((row) => ({ id: row.id, name: row.name }))
}
