/**
 * Helpers for the shared widget's API contract (`EscalatedWidget.vue` in
 * `@escalated-dev/escalated`): the shapes it reads from the widget routes.
 */

const EXCERPT_LENGTH = 150

/**
 * The plain-text line shown under a knowledge base search result.
 */
export function articleExcerpt(body: string | null | undefined): string {
  if (!body) return ''
  const text = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
  if (text.length <= EXCERPT_LENGTH) return text
  return `${text.slice(0, EXCERPT_LENGTH).trimEnd()}...`
}

/**
 * Whether a chat reply came from the agent side rather than the visitor.
 *
 * Visitor messages are stored without an author (the opening message), as
 * `Guest`, or, for a signed-in visitor, as that visitor's user.
 */
export function isAgentReply(
  reply: { authorType: string | null; authorId: number | string | null },
  session: { visitorId: number | string | null }
): boolean {
  if (reply.authorType === null || reply.authorType === undefined) return false
  if (reply.authorType === 'Guest') return false
  if (
    session.visitorId !== null &&
    session.visitorId !== undefined &&
    String(reply.authorId) === String(session.visitorId)
  ) {
    return false
  }
  return true
}

/**
 * The `department_id` a widget form posts: a positive integer, a numeric
 * string, or null/empty when no department was picked. Anything else is null.
 */
export function parseDepartmentId(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }
  if (typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value.trim())) {
    return Number(value.trim())
  }
  return null
}

/**
 * Resolve a posted `department_id` to an active department's id, or null when
 * it names none, so a stale or forged id never files work in a closed queue.
 */
export async function activeDepartmentId(value: unknown): Promise<number | null> {
  const id = parseDepartmentId(value)
  if (id === null) return null
  const { default: Department } = await import('../models/department.js')
  const department = await Department.query()
    .withScopes((scopes) => scopes.active())
    .where('id', id)
    .first()
  return department ? department.id : null
}
