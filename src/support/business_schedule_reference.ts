import BusinessSchedule from '../models/business_schedule.js'

/**
 * The `business_schedule_id` an SLA policy or department save sets, only when
 * the request sends the key, so a form that does not know about schedules
 * never clears one. An empty value or an id that does not exist clears it.
 */
export async function scheduleReference(
  input: Record<string, any>
): Promise<{ businessScheduleId?: number | null }> {
  if (!Object.prototype.hasOwnProperty.call(input, 'business_schedule_id')) return {}

  const id = Number(input.business_schedule_id)
  if (!input.business_schedule_id || !Number.isInteger(id) || id <= 0) {
    return { businessScheduleId: null }
  }

  const schedule = await BusinessSchedule.find(id)
  return { businessScheduleId: schedule ? schedule.id : null }
}
