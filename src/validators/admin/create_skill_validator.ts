import { validateSkillStorePayload } from './skill_payload.js'

/**
 * Validates POST `/escalated/admin/skills` body per the canonical
 * skills-management wire contract (snake_case keys).
 */
export async function createSkillValidator(input: Record<string, unknown>) {
  return validateSkillStorePayload(input, {})
}
