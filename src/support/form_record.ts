import type { LucidRow } from '@adonisjs/lucid/types/model'
import string from '@adonisjs/core/helpers/string'

/**
 * A record for a shared admin form, with its top-level keys in snake_case
 * (`is_active`, `business_schedule_id`, ...), as escalated-laravel serialises
 * its models. Lucid serialises camelCase here, which the shared pages do not
 * read. Nested values (JSON columns such as `first_response_hours`) are kept
 * as they are.
 */
export function formRecord(row: LucidRow): Record<string, unknown> {
  const serialized = row.serialize()
  return Object.fromEntries(
    Object.entries(serialized).map(([key, value]) => [string.snakeCase(key), value])
  )
}
