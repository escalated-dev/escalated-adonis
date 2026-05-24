# Cursor task: skills-management parity for escalated-adonis (greenfield)

Self-contained brief. Read this fully before doing anything.

## Goal

Greenfield: implement the canonical Skills-management contract end-to-end on this plugin.

**Tracking issue:** https://github.com/escalated-dev/escalated-adonis/issues/72
**Canonical contract:** https://github.com/escalated-dev/escalated-developer-context/blob/main/domain-model/skills-management.md
**ADR:** https://github.com/escalated-dev/escalated-developer-context/blob/main/decisions/2026-05-13-skills-routing-explicit-mapping.md
**Reference impl (study before coding):** https://github.com/escalated-dev/escalated-nestjs/pull/45 and https://github.com/escalated-dev/escalated-rails/pull/55

## Current state

No skills code in this repo today. AdonisJS / TypeScript backend with Lucid ORM. Reference controllers/services live in `src/controllers/admin_*.ts`. Match the patterns there.

## Deliverables

1. **Lucid migrations** (`database/migrations/`):
   - `create_escalated_skills` (if not already created elsewhere) — id, name, slug unique, description nullable, timestamps.
   - `create_escalated_agent_skills` — id, user_id, skill_id FK cascade, proficiency smallint default 3 with check 1..5, timestamps, unique(user_id, skill_id).
   - `create_escalated_skill_routing_tags` — id, skill_id FK cascade, tag_id FK cascade, unique(skill_id, tag_id).
   - `create_escalated_skill_routing_departments` — same shape with department_id.

2. **Lucid models** (`src/models/`): `Skill`, `AgentSkill`, `SkillRoutingTag`, `SkillRoutingDepartment`. Skill has `manyToMany routingTags` / `routingDepartments` (through the join models) and `hasMany agentSkills`. Add `description` on Skill.

3. **Validators** (`src/validators/admin/`): `createSkillValidator` and `updateSkillValidator` validating `name` (required, max 100, unique), `routing_tag_ids[]` (each exists in tags), `routing_department_ids[]` (each exists in departments), `agents.*.user_id` (exists in users + has agent/admin role), `agents.*.proficiency` (1..5).

4. **Controller** (`src/controllers/admin_skill_controller.ts`): 6 actions index/create/store/edit/update/destroy. Index payload: `{ skills: [{ id, name, agents_count, routing_tags_count, routing_departments_count, updated_at }] }`. Create/edit payload: form context + (on edit) skill object per the contract. Wrap multi-table writes in a transaction (`db.transaction(...)`).

5. **Routes** (`start/routes.ts` or equivalent): `resource('admin/skills', ...)` under the admin middleware group, named `escalated.admin.skills.*`.

6. **Sidebar wire-up**: confirm the admin sidebar (look at how other admin pages are surfaced) points at the skills index route.

7. **Tests** (`tests/`): CRUD round-trip, routing service explicit-mapping behaviour, validator rejection for non-agent user_id.

## Process

1. `git checkout -b feat/admin-skills-management`.
2. Read the contract + ADR + NestJS PR diff before coding.
3. Implement in this order: migrations → models → validators → controller → routes → tests.
4. Run: `npm install` if needed, `node ace test` (or whatever the repo uses), `npm run lint`.
5. Commit logically, reference #72.
6. Push, open PR titled `feat(skills): admin skills management parity (#72)`.

## Constraints
- Use AdonisJS 6 idioms consistent with the existing `admin_*_controller.ts` files.
- snake_case at the wire.
- Don't touch unrelated files. Stop after pushing the PR.
- The PROMPT file you're reading is untracked — do NOT include it in the PR.

## Self-check before pushing
- Tests green, lint clean, deliverables addressed.
