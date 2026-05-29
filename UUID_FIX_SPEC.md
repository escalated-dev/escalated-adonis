# Task: support UUID/string host-app user keys (escalated-adonis)

The AdonisJS package assumes the HOST app's user primary key is an integer.
Hosts with a UUID/string `users.id` break: Lucid migrations create
`integer().unsigned()` FK columns that can't hold a UUID, models type ids as
`number`, and several paths call `Number()` on user ids (corrupting UUIDs).
Make the package work with integer **and** UUID/string host user keys,
**defaulting to the current integer behavior** so existing installs are
unaffected.

## Step 1 — Helper

Create `src/helpers/user_id_column.ts`:

```ts
import type { Knex } from 'knex'

export type UserKeyType = 'int' | 'bigint' | 'uuid' | 'string'

/** Host user key type from env. Default 'int' (existing behavior). */
export function userKeyType(): UserKeyType {
  const raw = (process.env.ESCALATED_USER_KEY_TYPE ?? 'int').trim().toLowerCase()
  if (raw === 'bigint') return 'bigint'
  if (raw === 'uuid') return 'uuid'
  if (raw === 'string' || raw === 'varchar') return 'string'
  return 'int'
}

/**
 * Add a host-user-id column to a Lucid/Knex migration table, typed to match the
 * host user key. uuid/string -> varchar(255) (holds a UUID or stringified int).
 * Returns the ColumnBuilder so callers can chain .nullable()/.index()/.unique().
 */
export function userIdColumn(table: Knex.CreateTableBuilder, name: string): Knex.ColumnBuilder {
  switch (userKeyType()) {
    case 'bigint':
      return table.bigInteger(name).unsigned()
    case 'uuid':
    case 'string':
      return table.string(name, 255)
    default:
      return table.integer(name).unsigned()
  }
}

/** TS type for a host user id (number | string). */
export type UserId = number | string
```

(Env-based, not config-based, because migrations run before app config is fully
available — same reasoning as the NestJS port.)

## Step 2 — Migrations (schema fix)

In EACH file below, import `{ userIdColumn }` from the helper and replace the
host-user-id `table.integer('<col>').unsigned()...` with
`userIdColumn(table, '<col>')...` preserving the chained
`.nullable()/.notNullable()/.index()/.unique()`. ONLY change host-user-id
columns; leave Escalated's own integer FKs (ticket_id, department_id, skill_id,
role_id, etc.) alone.

- `database/migrations/0003_create_escalated_tickets.ts` — `requester_id` (~11), `assigned_to` (~15)
- `database/migrations/0004_create_escalated_replies.ts` — `author_id` (~17)
- `database/migrations/0007_create_escalated_ticket_activities.ts` — `causer_id` (~17)
- `database/migrations/0013_create_escalated_ticket_followers.ts` — `user_id` (~15)
- `database/migrations/0022_create_escalated_roles_and_permissions.ts` — `user_id` role_users (~48)
- `database/migrations/0025_add_snooze_fields_to_escalated_tickets.ts` — `snoozed_by` (~9)
- `database/migrations/0025_create_escalated_saved_views.ts` — `user_id` (~11)
- `database/migrations/0029_add_chat_status_to_agent_profiles.ts` — `user_id` (~9, keep .unique())
- `database/migrations/0041_create_escalated_mentions.ts` — `user_id` (~15)
- `database/migrations/0045_create_escalated_contacts.ts` — `user_id` (~22)
- `database/migrations/0048_create_escalated_agent_skills.ts` — `user_id` (~9)

(If any host-user-id column lives in a migration not listed, fix it too — grep
the migrations dir for `requester_id|assigned_to|author_id|causer_id|snoozed_by|created_by|agent_id|customer_id|\buser_id` and apply judgment: host user id → change; internal id → leave.)

## Step 3 — Model field types

Widen the host-user-id columns from `number` to `UserId` (import the type) in:
- `src/models/ticket.ts` — `requesterId` (~41), `assignedTo` (~44), `snoozedBy` (~122). Leave `contactId` (internal) as number.
- `src/models/reply.ts` — `authorId` (~20)
- `src/models/ticket_activity.ts` — `causerId` (~20)
- `src/models/agent_profile.ts` — `userId` (~13)
- `src/models/contact.ts` — `userId` (~28)
- `src/models/saved_view.ts` — `userId` (~17)
- `src/models/agent_skill.ts` — `userId` (~13)

(Also widen any other model that declares a host-user-id as `number`.)

## Step 4 — Remove Number() coercion on host user ids

Pass host user ids through unchanged (do NOT `Number()`/`Math.trunc` them):
- `src/controllers/api_ticket_controller.ts` ~289 — `assign(ticket, Number(agentId), user)` → pass `agentId` raw (widen the param type to `UserId`).
- `src/controllers/bulk_actions_controller.ts` ~32 — `assign(ticket, Number(value), ...)` → pass `value` raw.
- `src/controllers/admin_tickets_controller.ts` — same pattern if present.
- `src/services/skill_routing_service.ts` ~15,84,127,128 — `Number(id)`, `Number(r.user_id)` for user ids → keep as-is (string|number); only the eligibility/lookup should accept `UserId`.
- `src/services/macro_service.ts` ~29,35 — `Number(value)` for assign user ids → pass raw.
- `src/validators/skill_payload.ts` (or wherever `parseAgentRows`/`userIsEligibleAgent` live) — `Number(rec.user_id)` + `Math.trunc` → accept the id as `UserId` (string or positive number); drop the numeric truncation. `userIsEligibleAgent(userId: UserId)`.

Leave `Number()` on genuinely-integer values (proficiency, counts, internal ids).

## Step 5 — VineJS validators

Relax any validator that forces a host user id to be a number (e.g.
`vine.number()` on `agentId`/`userId`/`assignedTo`). Use a union that accepts a
string or number, e.g. `vine.union([...])` or
`vine.string()` OR `vine.number()` — the requirement: a UUID string must NOT be
rejected and an integer must still pass. If simplest, accept it as a string and
coerce only where an internal numeric id is required (not for host user ids).

## Step 6 — Test

Add `tests/unit/user_id_column.spec.ts` (match the repo's Japa test style):
- default → `userKeyType()` is `'int'`.
- `ESCALATED_USER_KEY_TYPE=uuid` → `userKeyType()` is `'uuid'`.
- save/restore `process.env.ESCALATED_USER_KEY_TYPE`.

## Step 7 — Build, test, commit

From repo root, make all green:

```
npm run build   # or: node ace ... / tsc — whatever the repo uses
npm test
npm run lint    # if present
```

Then commit (do NOT push):

```
git add -A
git commit -m "fix(users): support UUID/string host user keys"
```

Do NOT delete UUID_FIX_SPEC.md. Report every file changed and the final
build/test/lint status.
