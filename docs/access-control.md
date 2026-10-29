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
| Two-factor authentication | `access.twoFactor` | `ESCALATED_TWO_FACTOR` | enforced when on |
| Single sign-on | `access.sso` | `ESCALATED_SSO` | enforced when on |

```ts
// config/escalated.ts
access: {
  rolesPermissions: process.env.ESCALATED_ROLES_PERMISSIONS === 'true',
  twoFactor: process.env.ESCALATED_TWO_FACTOR === 'true',
  sso: process.env.ESCALATED_SSO === 'true',
},
```

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
- `escalated.two_factor_required`: whether the signed-in staff user must
  enrol before using anything (two-factor on, required, and not enrolled).

## Two-factor authentication

### What is enforced

With two-factor on (`access.twoFactor` / `ESCALATED_TWO_FACTOR`):

- **Enrolment** is at `{prefix}/admin/settings/two-factor`
  (`Admin/Settings/TwoFactor`), open to every agent and admin for their own
  account. `setup` creates a pending secret and flashes
  `two_factor_setup: { qr_uri, recovery_codes }`; `confirm` takes the 6-digit
  `code` and flashes `two_factor_confirmed: { recovery_codes }`; `disable`
  removes the enrolment; `recovery-codes` issues a new set. The secret is
  stored encrypted (AES-256-GCM, keyed from `APP_KEY`) and the recovery codes
  as SHA-256 hashes; neither is ever sent in props.
- **The challenge.** A staff user with a confirmed enrolment who opens any
  admin, agent or admin plugin route is redirected to
  `{prefix}/two-factor/challenge`, which renders `Auth/TwoFactorChallenge`
  with `action` (the absolute URL to post to) and `error`. JSON requests get
  403 with `two_factor_required: true` instead. Posting a `code` or a
  `recovery_code` there passes the challenge for that user in this session,
  regenerates the session ID and redirects to the page they asked for (else
  the agent ticket list, or reports for admins). A wrong code comes back as a
  validation error on the field sent.
- **TOTP** is RFC 6238 (SHA-1, 6 digits, 30 seconds) through the
  [`otpauth`](https://github.com/hectorm/otpauth) library, with one step of
  clock drift either side. The step of every accepted code is stored in
  `escalated_two_factor.last_used_step`; that step and earlier ones are
  refused afterwards, so a code works once.
- **Recovery codes**: eight are issued at setup; each signs in once.
- **Throttle**: 5 verify attempts per minute per user, then 429 with
  `Retry-After` (`twoFactor.verifyAttemptsPerMinute`; counters are per
  process unless you set `twoFactor.rateLimitStore`, the same store interface
  as `guestRateLimit.store`).
- **Every login is challenged.** The pass is cleared on
  `session_auth:login_succeeded` and `session_auth:logged_out`, which the
  `@adonisjs/auth` session guard emits. If your app signs users in some other
  way, clear it yourself on sign-in:
  `import TwoFactorSession from '@escalated-dev/escalated-adonis/support/two_factor_session'`
  and call `TwoFactorSession.forget(ctx.session)`.
- The token API is not session-based and is not challenged. Escalated does
  not own your password form; the challenge sits between the session and the
  panel. Customer pages are never challenged.

### Requiring it

`twoFactor.required` (`ESCALATED_TWO_FACTOR_REQUIRED`, default `false`) and the
runtime setting `two_factor_required` (Admin > Settings; the saved setting wins
once present). When required, a staff user without a confirmed enrolment is
redirected to the enrolment page and can use nothing else until they enrol.

```ts
// config/escalated.ts
twoFactor: {
  required: process.env.ESCALATED_TWO_FACTOR_REQUIRED === 'true',
  issuer: 'Acme Support', // the name authenticator apps show (default APP_NAME)
},
```

### Lost device

`node ace escalated:two-factor:reset you@example.com` (email or ID) removes a
user's enrolment so they can sign in and set it up again.

### Turning it on

1. Run the migrations (`0073` adds `last_used_step`).
2. Set `ESCALATED_TWO_FACTOR=true` (or `access.twoFactor: true`) and restart.
   Staff who enrolled while it was off are challenged from their next visit.
3. Only after telling staff, require it (`ESCALATED_TWO_FACTOR_REQUIRED=true`
   or the setting): everyone without an enrolment is sent to enrol.

## Single sign-on

### What is enforced

With `ESCALATED_SSO=true`, users sign in at `GET {prefix}/sso/login` through
the provider chosen in **Admin > Settings > SSO** (`sso_provider`: `saml`,
`oauth` or `jwt`). With `none`, and for any provider other than the chosen
one, the sign-in routes answer 404. With the switch off, every route below
and the SSO settings screen (`escalated.admin.settings.sso*`) answer 404.

| Route | Name | Use |
|---|---|---|
| `GET sso/login` | `escalated.sso.login` | Start sign-in (`?intended=/local/path` to land there) |
| `GET sso/saml/metadata` | `escalated.sso.saml.metadata` | SP metadata; its URL is the default SP entity ID |
| `POST sso/saml/acs` | `escalated.sso.saml.acs` | SAML assertion consumer (HTTP-POST) |
| `GET sso/oauth/callback` | `escalated.sso.oauth.callback` | OAuth 2 / OIDC redirect URI |
| `GET\|POST sso/jwt/callback` | `escalated.sso.jwt.callback` | JWT hand-off (`jwt` parameter) |

The SSO settings page receives these as `endpoints` to give the IdP, built
from `sso.baseUrl` (default `appUrl` / `APP_URL`), never from the request's
Host header. Secrets (`sso_jwt_secret`, `sso_oauth_client_secret`) reach the
page only as `********`; posting the mask back keeps the stored value.

The ACS and the JWT callback receive cross-site POSTs from the IdP, which
carry no CSRF token. If you use `@adonisjs/shield`'s CSRF check, let them
through (the signed, single-use assertion or token authenticates them):

```ts
// config/shield.ts
import { isSsoCsrfExempt, isWidgetCsrfExempt } from '@escalated-dev/escalated-adonis'

csrf: {
  enabled: true,
  exceptRoutes: (ctx) => isSsoCsrfExempt(ctx) || isWidgetCsrfExempt(ctx),
},
```

**SAML** (`xml-crypto` signatures). Refused unless: the IdP certificate is
configured; the **assertion** is signed by it (a signed Response alone is not
enough; `KeyInfo` keys are ignored); there is exactly one assertion and it is
not encrypted; `Issuer` is `sso_entity_id`; every `AudienceRestriction` names
the SP entity ID (`sso.spEntityId`, default the metadata URL); the Response
`Destination` and the bearer `Recipient` are the ACS URL; the validity windows
hold (`sso.clockSkew`, default 120 seconds, at most 300); `InResponseTo` names
an AuthnRequest this install issued in the last 10 minutes, used once
(IdP-initiated responses only with `sso.allowIdpInitiated`); and the assertion
ID has not been used before. Request IDs, used assertion IDs and JWT `jti`s
are kept in `escalated_sso_message_ids`, server-side, because the IdP's
cross-site POST does not carry a SameSite=Lax session cookie. Details in
[sso.md](sso.md).

**OAuth 2 / OIDC** (`openid-client`). Authorization-code flow with a
single-use `state` in the session and PKCE `S256`. The code is exchanged at
the token URL server to server (client secret posted in the body) and the
profile read from the userinfo URL with the access token. A missing or
mismatched `state`, an IdP `error`, or a profile with `email_verified: false`
is refused. If the provider returns an OIDC ID token, its `iss` must equal
`sso_entity_id` (default: the authorize URL's origin), so set that field to
the provider's issuer.

**JWT** (`jose`). The IdP sends the user back to the callback with `jwt`. The
algorithm is pinned to `sso_jwt_algorithm` (HS256/384/512 with the secret,
RS256/384/512 with a PEM public key or certificate in the same field), so
`alg: none` and algorithm switching fail. `exp`, `aud` (=
`sso.jwtAudience`, default the base URL) and `jti` are required; `nbf`/`iat`
are honoured with the clock skew; a `jti` works once.

### Users and roles

- The email comes from `sso_attr_email` (SAML falls back to an email-shaped
  NameID), the name from `sso_attr_name`, the role from `sso_attr_role`.
- The email is matched to a host user case-insensitively
  (`User.query().whereRaw('LOWER(email) = ?', ...)`, or your
  `sso.findUserByEmail`). An unknown email is refused unless
  `sso.createUsers` is on, which creates the user through `User.create()` (or
  your `sso.createUser`) with an unusable random password.
- With roles & permissions on and `sso.syncRoles` on, a role value naming an
  Escalated role slug replaces the user's roles; unknown values change
  nothing. SSO never changes your `isAdmin` / `isAgent` callbacks; it only
  signs the user in.
- The user is signed in with `ctx.auth.use(sso.guard).login(user)` (or your
  `sso.login`), the session is regenerated, and they land on the `intended`
  path, `sso.redirectTo`, or their dashboard. **With two-factor on, they
  still pass the challenge**: SSO sign-in clears the session's two-factor pass.
- Every refusal answers 403 with the same generic message; the reason is
  logged.

Escalated does not switch off your password login; do that in your app if you
want SSO only.

### Options

```ts
// config/escalated.ts
sso: {
  baseUrl: 'https://help.example.com', // default appUrl / APP_URL
  spEntityId: undefined,               // ESCALATED_SSO_SP_ENTITY_ID; default the metadata URL
  acsUrl: undefined,                   // ESCALATED_SSO_ACS_URL; default {baseUrl}/{prefix}/sso/saml/acs
  allowIdpInitiated: false,            // ESCALATED_SSO_ALLOW_IDP_INITIATED
  jwtAudience: undefined,              // ESCALATED_SSO_JWT_AUDIENCE; default baseUrl
  clockSkew: 120,                      // ESCALATED_SSO_CLOCK_SKEW; at most 300
  createUsers: false,                  // ESCALATED_SSO_CREATE_USERS
  syncRoles: false,                    // ESCALATED_SSO_SYNC_ROLES
  guard: undefined,                    // auth guard; default guard
  redirectTo: undefined,
},
```

These are install-level: no admin screen or stored setting changes them.

### Turning it on

1. Run the migrations (`0074` renames `escalated_saml_message_ids` to
   `escalated_sso_message_ids`).
2. Let the ACS and JWT callback past shield's CSRF check (above).
3. Set `ESCALATED_SSO=true` (or `access.sso: true`), choose the provider in
   Admin > Settings > SSO and give the IdP the endpoints shown there. SAML
   needs the IdP certificate and entity ID.
4. Decide on `sso.createUsers` and `sso.syncRoles`.
