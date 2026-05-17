import { validateSkillStorePayload } from './skill_payload.js'

/**
 * Validates PUT `/escalated/admin/skills/:id` body per the canonical
 * skills-management wire contract (snake_case keys).
 */
export async function updateSkillValidator(skillId: number, input: Record<string, unknown>) {
  return validateSkillStorePayload(input, { excludeSkillId: skillId })
}
