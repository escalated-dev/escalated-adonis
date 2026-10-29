# Access control: roles & permissions, two-factor, SSO

Escalated's roles & permissions, two-factor authentication and single sign-on
are **install-level switches**, off by default
([ADR 2026-10-29](https://github.com/escalated-dev/escalated-developer-context/blob/main/decisions/2026-10-29-configurable-access-features.md)).
While a switch is off its admin screens and routes answer 404 and nothing is
enforced; your `authorization.isAdmin` / `authorization.isAgent` callbacks
decide who may do what, exactly as before. While it is on, the feature is
enforced.

The switches are read from config only (`access` in `config/escalated.ts`).
No admin screen or stored setting changes them. A key left out of `access`
falls back to its environment variable.

| Feature | Config key | Env var | This release |
|---|---|---|---|
| Roles & permissions | `access.rolesPermissions` | `ESCALATED_ROLES_PERMISSIONS` | enforced when on |
| Two-factor authentication | `access.twoFactor` | `ESCALATED_TWO_FACTOR` | not enforced yet: always off |
| Single sign-on | `access.sso` | `ESCALATED_SSO` | not enforced yet: always off |

```ts
// config/escalated.ts
access: {
  rolesPermissions: process.env.ESCALATED_ROLES_PERMISSIONS === 'true',
},
```

Two-factor and SSO stay off until the releases that enforce them, so the
two-factor enrolment screen (`{prefix}/admin/settings/two-factor*`) and the
challenge (`{prefix}/two-factor/challenge`) answer 404 and the shared
`features.two_factor` / `features.sso` props are `false`.

## Roles & permissions

### What is enforced

With roles & permissions on, every admin, agent and staff API route needs a
permission **in addition to** the `isAdmin` / `isAgent` check for that area.
A user's permissions are the union of their Escalated roles' permissions.
Nothing else grants one: passing `isAdmin` gives no permissions by itself.
Give users who should have everything the `admin` role.

- The route to permission map is `src/support/route_permissions.ts`, a copy of
  escalated-laravel's. A route missing from it is refused, and a test checks
  that every admin, agent and staff API route is in it.
- A status change needs `ticket.edit`, plus `ticket.close` when the new status
  is `resolved`, `closed` or `reopened`.
- Bulk actions need the permission of the action: `assign` needs
  `ticket.assign`, `delete` needs `ticket.delete`, the rest `ticket.edit`
  (and `ticket.close` for a closing status).
- Applying a macro needs `macro.view` and `ticket.edit`.
- API tokens act as their owner, so the staff API checks the owner's
  permissions as well as the token's abilities.
- The newsletter screens check `newsletters.manage` and `newsletters.send` only
  while the switch is on.
- Your own two-factor settings need no permission.
- Routes that plugins register are the plugin's to guard.
- The mobile guest API and the public `auth/*` endpoints serve customers and
  are not affected.

Failing a permission answers 403 with `{ error, permission }`.

### Seeded roles

`node ace escalated:seed-permissions` (or the Lucid `PermissionSeeder`) creates
the permissions and three system roles:

| Role | Permissions |
|---|---|
| `admin` | all |
| `agent` | `ticket.*`, `reply.*`, `kb.view`, `report.view`, `macro.view`, `macro.create`, `tag.view`, `custom_field.view`, `audit.view` |
| `light_agent` | `ticket.view`, `reply.create`, `reply.create_internal`, `kb.view`, `macro.view`, `tag.view` |

Custom roles are made in **Admin > Roles**, which exists only while the
switch is on.

### Giving users roles

- From the command line:
  `node ace escalated:roles:assign you@example.com admin` (email or ID, then
  the role slug; `admin` when left out).
- From the admin: `PUT {prefix}/admin/users/:user/roles` with `role_ids`
  (needs `role.manage`; replaces the user's roles). You cannot remove your own
  `role.manage`. While the switch is on, the users page also receives each
  user's `roles` (slugs) and a `roles` list of `{id, name, slug}`.

### Turning it on

1. Seed the permissions: `node ace escalated:seed-permissions`.
2. Give every staff user a role, starting with yourself:
   `node ace escalated:roles:assign you@example.com admin`.
3. Set `ESCALATED_ROLES_PERMISSIONS=true` (or `access.rolesPermissions: true`)
   and restart.

Staff without a role can still reach their personal screens and nothing else.

### Shared props

- `escalated.features.roles_permissions`, `escalated.features.two_factor`,
  `escalated.features.sso`: the switches.
- `escalated.permissions`: with roles & permissions on, the signed-in user's
  slugs. Off, `['*']` for staff (the gates decide everything) and `[]` for
  anyone else.
- `escalated.two_factor_required`: `false` in this release.
