# Changelog

## [Unreleased]

## [0.7.8] - 2026-10-30

### Upgrading
- **SDK plugin endpoints and webhooks moved to the plugin contract's paths**, the ones escalated-laravel and escalated-rails use: endpoints from `{prefix}/plugins/{slug}/api/{path}` to `{prefix}/api/plugins/{slug}/{path}`, webhooks from `{prefix}/plugins/{slug}/webhooks/{path}` to `{prefix}/webhooks/plugins/{slug}/{path}` (so `@acme/plugin-crm`'s `/inbound` webhook is now `POST /support/webhooks/plugins/acme--plugin-crm/inbound`). The old URLs are 404. **Update every webhook URL you registered with a third party** (Slack, Stripe, a CRM) for an SDK plugin, and any CSRF exemption you added for the old webhook path. Inactive plugins still answer 404. A plugin no longer sees the `Cookie`, `Authorization`, `X-XSRF-TOKEN`, `X-CSRF-TOKEN` or `Proxy-*` headers; an endpoint runs as the signed-in user (`ctx.currentUser()`, the actor of its `ctx` writes) and a webhook as nobody; and a handler that throws answers 500 with a generic message instead of the error.
- **`ctx.replies.create`, `ctx.tickets.create`, `ctx.tickets.update` and `ctx.contacts.create` only accept the plugin contract's fields** (plugin contract, The plugin context). They passed the plugin's data straight to Lucid `create()`/`merge()`, so a plugin could set a reply's author or internal-note flag, a ticket's requester, assignee or SLA fields, or any column of the host's user model. Any other key is now an error naming it. Replies: `ticket_id` (an existing ticket), `body`, `is_internal` (true makes a note); the author is the acting user (`ctx.currentUser()`), or nobody. Tickets: `subject`/`title`, `body`/`description`, `priority`, `status`, `department_id`, `ticket_type`, `metadata`, and on create `channel` (default `api`) and `contact_id` or `requester_email`/`requester_name` (a contact, found or created); never a requester id, assignee, reference or SLA field. Contacts: `name`, `email`. Plugins that sent camelCase model attributes or other keys must switch to these.
- **SDK plugins can now be activated and deactivated, and only active ones run** (plugin contract, Lifecycle). Before, every SDK plugin the bridge loaded got every hook, cron schedule and badge, and its pages, endpoints, webhooks, menus and widgets were live, with no way to switch it off. The first time the app boots after upgrading, every SDK plugin installed at that moment is recorded active in `escalated_plugins`, so nothing that ran before stops. SDK plugins installed afterwards start inactive: activate them on **Admin > Plugins**. No migration is needed. Inactive SDK plugins get no hooks, cron or badges, add no menus, widgets or slots, and answer 404 on their pages, endpoints and webhooks.
- An SDK plugin's `onActivate` now runs when an admin activates it and `onDeactivate` when an admin deactivates it, as the plugin contract says; they no longer run on every boot and shutdown. Plugins that set up in-memory state in `onActivate` should do it at import time instead.
- Activating or deactivating a plugin from **Admin > Plugins** now answers with a 303 to the index instead of a redirect back, and an unknown slug is an `error` flash (404 for JSON requests). The page's `plugins` are now the contract's snake_case plugin objects (`is_active`, `activated_at`, `author_url`, `homepage`, `provides`), which the shared page reads; they were camelCase. The page receives `can_upload: true`.
- **SDK plugin cron schedules run only if you schedule
  `node ace escalated:plugins:cron` every minute** (cron, a process manager
  or a scheduler package). Until then nothing changes: they never ran before.
- **Roles & permissions is now an install-level switch, off by default**
  (`access.rolesPermissions` in `config/escalated.ts`, env
  `ESCALATED_ROLES_PERMISSIONS`; ADR 2026-10-29-configurable-access-features).
  Roles were stored but never enforced, so off is how every install already
  behaved, with these visible differences:
  - While it is off, the roles screens (`{prefix}/admin/roles*`) answer 404.
  - While it is off, the newsletter screens no longer check
    `newsletters.manage` / `newsletters.send`; the admin gate decides, like
    every other screen. Installs that used those permissions to restrict
    admins must turn the switch on.
  - The shared `escalated.permissions` prop is `['*']` for staff while the
    switch is off (it was the user's role slugs, which nothing enforced), and
    `escalated.features` gains `roles_permissions`, `two_factor` and `sso`.
  To enforce roles: seed the permissions (`node ace escalated:seed-permissions`),
  give every staff user a role (`node ace escalated:roles:assign you@example.com admin`),
  then set `ESCALATED_ROLES_PERMISSIONS=true` (or `access.rolesPermissions: true`).
  Passing the admin check grants no permissions by itself, so an admin without
  a role is refused everywhere. See `docs/access-control.md`.
- **Two-factor authentication is an install-level switch, off by default**
  (`access.twoFactor`, env `ESCALATED_TWO_FACTOR`). Staff could enrol in TOTP
  but no sign-in ever asked for the code. While it is off, the enrolment
  screen (`{prefix}/admin/settings/two-factor*`) and the challenge
  (`{prefix}/two-factor/challenge`) answer 404 and nobody is challenged;
  enrolments already stored are kept. To enforce it: run the migrations
  (`0073` adds `escalated_two_factor.last_used_step`), then set
  `ESCALATED_TWO_FACTOR=true`. Staff who enrolled while it was unenforced are
  challenged from their next visit. Set `ESCALATED_TWO_FACTOR_REQUIRED=true`
  (or `twoFactor.required`, or the `two_factor_required` setting) only after
  telling staff, since everyone without an enrolment is sent to enrol.
  Hosts that sign users in with `@adonisjs/auth`'s session guard need nothing
  else; a host with its own login must call
  `TwoFactorSession.forget(ctx.session)` on sign-in. See
  `docs/access-control.md`.
- **New TOTP secrets are 160 bits** (32 base32 characters, was 16), and TOTP
  now runs on the `otpauth` library instead of hand-written code. Existing
  secrets keep working.
- **Single sign-on is an install-level switch, off by default** (`access.sso`,
  env `ESCALATED_SSO`). SSO settings were saved but no route signed anyone in.
  While it is off, the SSO settings screen (`{prefix}/admin/settings/sso`) and
  every sign-in route answer 404; stored settings are kept. To use it: run the
  migrations (`0074` renames `escalated_saml_message_ids` to
  `escalated_sso_message_ids`), let `{prefix}/sso/saml/acs` and
  `{prefix}/sso/jwt/callback` past shield's CSRF check
  (`csrf.exceptRoutes: (ctx) => isSsoCsrfExempt(ctx)`), set `appUrl` (or
  `sso.baseUrl`) to your public URL, set `ESCALATED_SSO=true`, give the IdP
  the endpoints from the SSO settings page, and decide on `sso.createUsers` /
  `sso.syncRoles` (both default off). See `docs/access-control.md`.
- **SAML's SP entity ID, ACS URL, IdP-initiated sign-in and clock skew are
  install-level options now** (`sso.spEntityId`, `sso.acsUrl`,
  `sso.allowIdpInitiated`, `sso.clockSkew`, or `ESCALATED_SSO_*`), not the
  `sso_sp_entity_id`, `sso_acs_url`, `sso_allow_idp_initiated` and
  `sso_clock_skew` settings, which are ignored. The entity ID and ACS URL
  default to `{baseUrl}/{prefix}/sso/saml/metadata` and `.../saml/acs`; if
  your IdP was registered with other values, set them in config.
  `sso_entity_id` (the IdP's Issuer) is now required, and only a signature on
  the assertion itself counts: a signed Response around an unsigned assertion
  is refused.
- `SsoService.validateSamlAssertion()` and `validateJwtToken()` return
  `{ email, name, role }` (no `attributes` / `claims`), and
  `validateJwtToken()` now verifies with `jose` and requires `exp`, `aud` and
  a single-use `jti`. Hosts that called them from their own routes can use
  the package's routes instead.
- **Plugin UI extensions are shared as `escalated.plugins`** (`menuItems`,
  `pageComponents`, `dashboardWidgets`), the shape the shared frontend reads.
  Before, nothing was shared, so plugin menus, widgets and slots never
  appeared. Built from native plugins' registrations and SDK plugins'
  manifests (`pages[].menu`, `widgets`, `components`); admin menu items go to
  admins only and items whose permission or capability the viewer lacks are
  left out. `{}` when there is nothing to show.
- **Plugins receive the canonical domain events under their canonical names.**
  SDK plugins got `ticket_created`, `reply_created`, `department_changed` and
  so on, with the ticket's Lucid JSON under `ticket`; they now get
  `ticket.created`, `reply.created`, `ticket.department_changed`, ... with the
  plugin contract's payload (the ticket flat and under `ticket`, snake_case).
  Native plugins now receive them too, through `escalated_addAction()`.
  Delivery no longer depends on the SDK bridge having booted, and a failing
  plugin never fails the request. Rename any action handlers keyed on the old
  names.
- **`ctx.tickets.query` and `ctx.replies.query` only accept the plugin
  contract's filter keys.** Tickets: `id`, `reference`, `status`, `priority`,
  `channel`, `ticket_type`, `department_id`, `requester_id`, `contact_id`,
  `assigned_to`. Replies: `ticket_id`, `is_internal`, `type`. Any other key,
  or a non-scalar value, throws instead of becoming a column name. Results are
  capped at 500 rows.

### Fixed
- **Admin > Users roles picker validation now answers like escalated-laravel.**
  A bad `role_ids` on `PUT /support/admin/users/:user/roles` used to answer a
  JSON 422, which the shared screen cannot show; it now goes back to the screen
  with the error on `role_ids` or `role_ids.N` and Laravel's wording (present,
  array, integer, existing role).

### Added
- **SDK plugins on Admin > Plugins**: listed by slug with `name`, `version`, `description`, `is_active`, `activated_at`, `source: composer` and `provides` counts, activated and deactivated there (`PluginBridge.activate()` / `deactivate()`); uninstalling is refused (npm manages them).
- **Lifecycle actions `plugin.activated`, `plugin.deactivated` and `plugin.uninstalling`** with `{plugin, slug}`, to native and SDK plugins, in the contract's order. A throwing callback is logged and does not undo the transition.
- **Single sign-on works when switched on.** `GET {prefix}/sso/login` starts
  sign-in with the provider chosen in Admin > Settings > SSO. SAML requires a
  signed assertion from the configured certificate and checks Issuer,
  Audience, Destination, Recipient, validity windows, InResponseTo against
  AuthnRequests this install issued (stored server-side, single use) and
  assertion replay; `{prefix}/sso/saml/metadata` serves the SP metadata.
  OAuth 2 / OIDC (`openid-client`) uses a session-bound single-use `state` and
  PKCE S256 and reads the userinfo endpoint. JWT (`jose`) pins the configured
  algorithm and requires `exp`, `aud` and a single-use `jti`. Users are matched
  by email (case-insensitive); `sso.createUsers` creates unknown ones and
  `sso.syncRoles` maps the role attribute to an Escalated role while roles are
  on. SSO sign-in is still challenged for two-factor. New routes
  `escalated.sso.login`, `.saml.metadata`, `.saml.acs`, `.oauth.callback`,
  `.jwt.callback`; `Admin/Settings/SsoSettings` is rendered (secrets masked,
  plus `endpoints`), and the shared `features.sso` follows the switch.
- `isSsoCsrfExempt(ctx)` for shield's `csrf.exceptRoutes`.
- **Two-factor authentication is enforced when switched on.** A staff user
  with a confirmed enrolment is sent to `{prefix}/two-factor/challenge`, which
  renders `Auth/TwoFactorChallenge` with `action`, before any admin, agent or
  admin plugin route (`requireTwoFactor` middleware; JSON requests get 403
  with `two_factor_required: true`). A TOTP code (one step of drift, each
  code works once: the step is recorded in `last_used_step`) or a single-use
  recovery code passes it for that user until the next login or logout; the
  session ID is regenerated. Verify is throttled to 5 attempts a minute per
  user (`twoFactor.verifyAttemptsPerMinute`, `twoFactor.rateLimitStore`).
  The token API is not challenged.
- Two-factor enrolment is open to agents, not only admins. `confirm` flashes
  `two_factor_confirmed: { recovery_codes }` and the page gets `required`.
- "Require two-factor": `twoFactor.required` / `ESCALATED_TWO_FACTOR_REQUIRED`
  and the runtime `two_factor_required` setting (Admin > Settings; wins once
  saved). Staff without an enrolment are sent to enrol and reach nothing else.
  The shared `escalated.two_factor_required` prop says so.
- `node ace escalated:two-factor:reset <email or id>` clears a user's
  enrolment (lost device).
- SDK plugin cron schedules (domain-model/plugin-contract.md, Cron):
  `node ace escalated:plugins:cron` runs each five-field (UTC) `cron` schedule
  of each active SDK plugin that is due that minute, as no user
  (`ctx.currentUser()` is `null`), within 30 s each. A failing, slow or
  unreadable schedule is logged and never stops the others. `--at <ISO time>`
  runs a given minute.
- SDK plugin widget badges (Badges): a widget with a `badge` function carries
  its answer in `escalated.plugins.dashboardWidgets[].badge`, asked as the
  viewer (`ctx.currentUser()` is the signed-in user) within 5 s; `null` when
  it fails. Widgets without one carry no `badge` key.
- **Roles & permissions are enforced when switched on.** Every admin, agent
  and staff API route needs its permission from the user's roles as well as
  the `isAdmin` / `isAgent` check (`enforceRoutePermissions` middleware, map in
  `src/support/route_permissions.ts`; unmapped routes are refused, and a test
  checks every route is mapped). Status changes to `resolved`/`closed`/`reopened`
  also need `ticket.close`, bulk actions need each action's permission, and the
  staff API checks the token owner's permissions. Failing answers 403.
- `ensureFeatureEnabled({ feature })` named middleware: 404 while an access
  feature is switched off.
- `node ace escalated:roles:assign {user} {role=admin}` gives a user a role by
  email or ID.
- `PUT {prefix}/admin/users/:user/roles` (`escalated.admin.users.roles`, needs
  `role.manage`) replaces a user's roles; you cannot remove your own
  `role.manage`. While roles are on, the users page also receives each user's
  `roles` and the assignable `roles`.

### Security
- Plugin ticket and reply queries used the filter's keys as column names, so a
  plugin could filter on any column (such as the guest access hash). Keys are
  now whitelisted.
- `ctx.emit` drops hook names that would impersonate a canonical event, a
  legacy alias of one, or a plugin lifecycle action.

## [0.7.7] - 2026-10-28

### Upgrading
- `POST /widget/chat/start` now answers exactly as escalated-laravel: `201
  { id, session_id, expires_at, ticket_reference, status, agent_name }`, where
  `id` and `session_id` are both the chat token (plus `visitor_token`,
  `messages` and `agent`). The numeric `session_id` is no longer returned; use
  `id` for the widget chat routes and `ticket_reference` to name the ticket.
- Run the migrations (`0072_add_chat_visitor_token_expiry`): it adds a nullable
  `visitor_token_expires_at` to `escalated_chat_sessions`. Chats already in
  progress keep working: the next widget request with their token stores the
  token's hash in place of the plain value and gives it a full lifetime.
- Widget chat tokens now expire `guestAccess.ttlMinutes` after the chat starts
  (default 1440, clamped to 5 minutes .. 7 days), as in escalated-laravel.
  After that every `/widget/chat/:token/*` path answers 404 and the visitor
  starts a new chat.
- `ChatSession.visitorToken` now holds the token's SHA-256 and is no longer
  serialized; `ChatSessionService.startChat` still returns the token once as
  `visitorToken` (with `visitorTokenExpiresAt`). The chat's ticket no longer
  gets the token as its `guest_token`.

### Security
- **Widget chat tokens are stored hashed and expire.** The token returned by
  `POST /widget/chat/start` (`id`, `visitor_token`) was stored in plain text,
  on the chat session and as the ticket's `guest_token`, and never expired.
  Only its SHA-256 is stored now, the start answer carries `expires_at`, and
  an unknown or expired token is a 404 on every chat path.

### Added
- **Mobile guest API**, per the shared contract
  (https://github.com/escalated-dev/escalated-developer-context/blob/main/domain-model/mobile-guest-api.md):
  `POST guest/verification`, `POST guest/lookup`, `POST guest/tickets`,
  `GET guest/tickets/:token` and `POST guest/tickets/:token/replies` under
  `{api.prefix}/mobile` (default `support/api/v1/mobile`). They reuse the
  verified guest access codes and grants, so a grant from one surface opens the
  others, and share the API rate limit and the per-IP guest buckets with the
  browser and widget guest routes. Registered only while `api.enabled` is on;
  hosts that never enabled the API see no new routes. See
  `docs/guest-access.md`.

### Changed
- `POST verification` on every guest surface now answers 422 on a malformed
  `email` even when `purpose` is also invalid (it was accepted as far as the
  purpose check).
- An ended chat answers 422 (was 400) to a message and to a second `end`, and
  422 to `typing` (was 200). `rate` answers 422 until the chat has ended (it
  rated open chats), as in escalated-laravel. The token is now checked before
  the request body, so an unknown token is a 404 even with an empty message.

## [0.7.6] - 2026-10-22

### Upgrading
- `SsoService.validateSamlAssertion` now refuses every SAML response unless `sso_certificate` holds the IdP's signing certificate (PEM, bare base64 body, or PEM public key) and the assertion or Response is signed by it. Hosts that call it from their own ACS route must configure the certificate first. Encrypted assertions and responses with more than one assertion are refused. Escalated still registers no SSO route. See `docs/sso.md`.
- New dependency: `xml-crypto` (XML signature verification).
- SAML sign-in now also needs `sso_sp_entity_id` (our SP entity ID, checked against the Audience) and `sso_acs_url` (our ACS URL, checked against the Destination and Recipient); with either empty every SAML response is refused. Run the migrations (`0071_create_escalated_saml_message_ids`) for the request and replay store. Call `SsoService.createSamlRequestId()` when building the AuthnRequest and pass the ID to `validateSamlAssertion(response, { requestId })`: a response that answers no request we issued is refused unless `sso_allow_idp_initiated` is `1`. Assertions need a bearer SubjectConfirmation with `Recipient` and `NotOnOrAfter`. `sso_clock_skew` (seconds, default 120, at most 300) sets the skew. See `docs/sso.md`.

### Security
- **SAML assertions are signature-checked.** `SsoService.validateSamlAssertion` read the email from whatever XML it was given, so an unsigned or forged assertion could name any user to a host that wired it into a login route. It now verifies the XML signature against the configured IdP certificate with `xml-crypto`, never trusts a key carried in the message's `KeyInfo`, and reads the user, issuer and conditions only from the XML the signature covers, so a signature-wrapping response cannot substitute another user.
- **Signed SAML assertions are bound to this SP, this sign-in, and one use.** A correctly signed assertion was accepted whoever it was issued for and however often: one issued by the same IdP to another service provider, or captured from an earlier sign-in, signed its subject in here. `validateSamlAssertion` now requires our SP entity ID in every `AudienceRestriction`, our ACS URL as the `Destination` and the bearer `Recipient`, `Conditions` and `SubjectConfirmationData` `NotBefore` / `NotOnOrAfter` inside the window, an `InResponseTo` naming an unanswered request we issued (IdP-initiated only when `sso_allow_idp_initiated` is on), and an assertion `ID` not accepted before; used IDs are kept until the assertion expires.

### Fixed
- **Chat transfer reads `department_id`.** `POST /agent/chats/:id/transfer`
  took only `agent_id`, so the shared ticket view's Transfer menu (which offers
  departments and posts `{"department_id"}`) was refused with 400. It now reads
  `agent_id` and/or `department_id`, as escalated-laravel does: a department
  takes the ticket (and the session), and without an agent the chat goes back
  to the queue (unassigned, waiting) and is routed again for that department.
  The older `{"type", "id"}` body is read too, and `agent_id` alone behaves as
  before. An unknown department is a 422. `chat.transferred` carries
  `to_department_id`. `ChatSessionService.transfer(sessionId, agentId, causer,
  { departmentId })` takes the department as a new optional fourth argument.
- **End Chat from the ticket view.** The shared agent ticket page ends a chat
  by POSTing `{}` to `route('escalated.admin.chat.end', chat_session_id)`,
  a name this package did not register, so the button did nothing. It is now
  registered at `POST {prefix}/admin/chat/:session/end` (escalated-laravel's
  name and path) behind the same agent middleware as the agent chat routes.
  Like Laravel it answers `{"message": "Chat ended."}` (plus the `session`),
  or 422 `{"message": "Chat is already ended."}` when the chat already ended.
  `POST /agent/chats/:id/end` (`escalated.agent.chats.end`) is unchanged.

## [0.7.5] - 2026-10-22

### Upgrading
- Saving a webhook with the secret field left blank (or missing) now keeps the stored secret, because the edit form no longer receives it. Send `clear_secret: true` to remove it; a non-blank secret replaces it as before. Creating a webhook is unchanged.
- The general settings page now shows a stored Mailgun signing key, Postmark inbound token or IMAP password as `********` (it showed the first three characters). Posting the mask back, or the older `abc*****` form, keeps the stored value; any other value replaces it, as before.
- The import index and progress pages' `job` objects no longer carry `user_id` or `updated_at`, and `error_log` holds the newest 50 entries, as escalated-laravel sends them. The status poll is unchanged.
- To enforce the new Data Retention settings, run `node ace escalated:purge-expired` daily from your scheduler or cron. Every retention period defaults to `never`, so until an admin sets one the command only removes tickets soft-deleted more than 30 days ago (through `DELETE /api/v1/tickets/:ticket`) and expired guest verification codes.
- `POST {prefix}/admin/settings/public-tickets` now answers as well as PUT (the shared page posts). The guest policy save now validates as escalated-laravel does: an unknown `guest_policy_mode`, a missing or non-positive `guest_policy_user_id` in `guest_user` mode, or a template over 500 characters goes back with field `errors` and saves nothing, where it was coerced before. `guest_policy_user_id` is passed to the page as a string (or null), as Laravel passes it.
- A CSAT settings form that fails validation now flashes field `errors` (keyed by setting) instead of one `error` message, and a blank `csat_delay_hours` is refused.
- Run the migrations (`0070_add_user_id_to_escalated_import_jobs`): a nullable `user_id` on `escalated_import_jobs`, the admin who started the import.
- The import routes follow escalated-laravel's. `escalated.admin.import.mapping`, `.start` and `.pause` now name the wizard's routes (`GET import/:platform/mapping`, `POST import/:platform/start`, `POST import/pause/:jobId`); the job-first ones are still served, by uuid, as `escalated.admin.import.job_mapping`, `.job_start` and `.job_pause`. `POST import/:id/start` now redirects to `import/progress/:jobId`.
- Run the migrations (`0067_create_escalated_ticket_statuses`). It creates `escalated_ticket_statuses`, seeds one system row per built-in status, and adds a nullable `escalated_tickets.ticket_status_id` (`ON DELETE SET NULL`). Existing tickets keep their status and get no custom status; nothing else changes until an admin adds one.
- Run the migrations (`0068_create_escalated_business_schedules`): new tables `escalated_business_schedules` and `escalated_holidays`, and a nullable `business_schedule_id` on `escalated_sla_policies` and `escalated_departments`. With no schedule configured, business-hours deadlines are counted exactly as before, against `sla.businessHours`.
- Run the migrations (`0069_create_escalated_custom_fields`: `escalated_custom_fields`, `escalated_custom_field_values`, `escalated_custom_objects`, `escalated_custom_object_records`). With no custom fields defined, every ticket request behaves as before.

### Added
- The admin Import wizard, on escalated-laravel's routes and props: `Admin/Import/Index` (`GET {prefix}/admin/import`, `adapters` and the 20 newest `jobs`), `Connect` (`GET import/:platform/connect`, with `POST import/:platform/test-connection` answering `{ success[, error] }`, 422 when the source throws), `Mapping` (`GET import/:platform/mapping`, `mappings` per entity type with `defaults` and `source_fields`), `Review` (`POST import/:platform/review`, which writes nothing), `start` (`POST import/:platform/start`) and `Progress` (`GET import/progress/:jobId`, polled through `GET import/status/:jobId`, with `POST import/{pause,resume,cancel}/:jobId`). Sources are still the adapters registered on the `import.adapters` filter; core ships none. Tested credentials wait in the session, encrypted, until the import starts, and are never sent to the browser. Jobs are sent snake_case, without their credentials.
- Imports run through `dispatchImport()` (`src/services/import_runner.ts`): in this process after the response by default, or through your queue by registering the `import.run_async` action and calling `runImportJob(id)` from the worker. A failed run marks the job failed; resume continues from the saved cursors.
- `ImportAdapter.availableSourceFields()` is typed as Laravel's `{ name, label, escalated_options }` objects (`SourceField`); a bare string still type-checks but shows as a blank row.
- Custom ticket statuses, per the shared statuses spec. An admin defines statuses under `{prefix}/admin/statuses` (the shared `Admin/Statuses/Index` and `Admin/Statuses/Form` pages, `escalated.admin.statuses.index|create|store|edit|update|destroy`, admin only), with escalated-laravel's props and validation; `is_default` is exclusive within a category, and a blank slug comes from the label (`waiting_on_vendor`, then `_2`, `_3`). Each status belongs to a category (`new`, `open`, `pending`, `on_hold`, `solved`), and a ticket given one takes the category's built-in anchor status (`open`, `open`, `waiting_on_customer`, `in_progress`, `resolved`) through `TicketService.changeStatus`, so the anchor's transition check, `resolved_at`/`closed_at`, SLA, events and notifications apply; `ticket_status_id` records the sub-status. A move between two statuses with the same anchor skips the transition check and still emits `ticket.status_changed`. The agent and admin status endpoints, `PATCH /api/v1/tickets/:ticket/status`, bulk `status`, macro `status` and workflow and automation `change_status` accept a custom slug as well as a built-in value; unknown values are rejected as before. Setting a built-in status by any path (including snooze, unsnooze, merge and live chat) clears the custom status. The built-ins are listed as system rows: their slug and category cannot change and they cannot be deleted. Deleting a custom status leaves its tickets in their built-in status. Changing a status's category does not move tickets already in it; tickets that take it later get the new anchor.
- Agent and admin ticket pages and API ticket responses carry `custom_status` (`{id, label, slug, color, category}` or null) and `status_category`. The `status` filter there also takes a custom slug. Customer and guest views show the built-in status only. `ticket.status_changed` (`TicketStatusChangedData`) gains `oldCustomStatus`, `newCustomStatus`, `oldCategory` and `newCategory`, and the plugin `ticket_status_changed` payload `old_custom_status`, `new_custom_status`, `old_category` and `new_category`; existing keys are unchanged.
- Business schedules and holidays, as escalated-laravel's BusinessSchedule, Holiday and BusinessHoursCalculator. A schedule has a `timezone` and per-weekday `schedule` (`{ monday: { start: "09:00", end: "17:00" }, ... }`, an empty start or end closing the day); holidays are one-off dates or `recurring` every year. When a policy is `business_hours_only`, SLA deadlines are counted against the policy's `business_schedule_id`, then the ticket's department's, then the default schedule (`is_default`), and against `sla.businessHours` when there is none. Hours are wall-clock times in the schedule's zone, counted in real elapsed time (daylight-saving days are an hour shorter or longer); `24:00` is midnight, an end before the start is an overnight window, and a holiday closes the window that opens on it. A schedule with no open day counts calendar time.
- The shared `Admin/BusinessHours/Index` and `Admin/BusinessHours/Form` pages, as escalated-laravel's BusinessHoursController: `{prefix}/admin/business-hours` with `escalated.admin.business-hours.index|create|store|edit|update|destroy` (PATCH also updates). Index gets `schedules` with their `holidays`; the form gets `timezones` and, on edit, `schedule`. Saving a default schedule clears the previous default, an update replaces the holidays, and deleting a schedule clears the policy and department references to it. Invalid fields go back with `errors` keyed as Laravel's (`name`, `timezone`, `schedule`, `holidays.N.name`, `holidays.N.date`).
- SLA policy and department saves accept `business_schedule_id`, only when it is sent, so a form that does not send it leaves it as it is. An id that names no schedule is a field error (`business_schedule_id`) and nothing is saved. The `Admin/SlaPolicies/Form` and `Admin/Departments/Form` pages receive a `schedules` prop (`[{id, name}]`, by name) for the shared frontend's **Business hours schedule** picker.
- Custom fields, as escalated-laravel's CustomFieldController: `{prefix}/admin/custom-fields` (`escalated.admin.custom-fields.index|create|store|edit|update|destroy|reorder`) renders the shared `Admin/CustomFields/Index` (`fields`, ordered by position, every column snake_case) and `Admin/CustomFields/Form` (`field`, `contexts`). Types `text`, `textarea`, `select`, `multi_select`, `checkbox`, `date`, `number`; contexts `ticket`, `user`, `organization`. The slug comes from the name with `_` separators (`region_2` when taken). `select` and `multi_select` need at least one option. Deleting a field deletes its values.
- Ticket custom field values. Customer ticket create (`POST {prefix}`), agent ticket update (`PUT {prefix}/agent/tickets/:ticket`) and API ticket create (`POST {api}/tickets`) accept an optional `custom_fields` object keyed by field slug. Only active `ticket` fields count; unknown or inactive keys are refused. Values are checked before the ticket is written (errors keyed `custom_fields.<slug>`: flashed `errors` and back, or 422 on the API): required on create, and a sent required field cannot be blank on update; `number` numeric, `date` `YYYY-MM-DD`, `checkbox` boolean or 0/1, `select` one of the options, `multi_select` an array of options, `text` at most 255 characters. An empty optional value deletes the stored one, and an update without `custom_fields` changes none. `Customer/Create` gets the definitions as `custom_fields`; `Customer/Show`, `Agent/TicketShow`, `Admin/Tickets/Show` and the API ticket detail get them with a decoded `value`. Guest and widget ticket creation do not take custom fields yet.
- Custom objects, as escalated-laravel's CustomObjectController: `{prefix}/admin/custom-objects` (`escalated.admin.custom-objects.index|create|store|edit|update|destroy|records|records.store|records.update|records.destroy`) renders the shared `Admin/CustomObjects/Index` (`objects` by name with `records_count`), `Form` (`object`) and `Records` (`object`, `records` newest first). The slug is required, unique and alpha-dash; `fields_schema` needs at least one field of type `text`, `number`, `select`, `date` or `lookup`. Record `data` is checked against the schema (errors keyed `data.<name>`): required fields, numbers, dates, select options, and no unknown keys. Deleting an object deletes its records; a record reached through another object is a 404.
- SDK plugin pages, as escalated-laravel's RouteRegistrar: each page in a plugin manifest's `pages` is `GET {prefix}/admin/plugins/{plugin}/{route}` (named `escalated.plugin.{plugin}.page.{route}`, plugin and route slugged as for plugin endpoints), behind the admin middleware, rendering the shared `Escalated/Plugin/Page` with `plugin`, `component`, `layout` (default `admin`) and `props` from the plugin's `GET /{component}` endpoint (empty when it has none). Pages without a route or component are skipped with a warning. A page's `capability` is not checked beyond admin access, as for plugin endpoints.
- The shared report screens `Admin/Reports/Dashboard`, `AgentMetrics`, `SlaReport` and `CsatReport`, as escalated-laravel's ReportController: `GET {prefix}/admin/reports/dashboard|agents|sla|csat` (`escalated.admin.reports.dashboard|agents|sla|csat`, `?days=`, default 30). The Reports overview already linked to these names, which did not exist, so it failed on its first link. Figures come from a new `ReportingService` with Laravel's shapes: charts as `{label, value}`, agent rows with `agent_id`, `agent_name`, `total_tickets`, `resolved_tickets`, `avg_response_hours`, `avg_resolution_hours`; SLA compliance by active policy and the latest 100 breaches with `sla_policy`; CSAT average, response rate, by agent and per day. As in Laravel, agents the user model no longer finds are left out of agent rows.
- `Admin/Reports/AgentDetail` at `GET {prefix}/admin/reports/agent/:id/detail` (`escalated.admin.reports.agent-detail`), which the agent ranking links to. It gets the props the screen reads (`agent`, `total_tickets`, `resolved_tickets`, `avg_frt`, `avg_resolution`, `csat_score`, `response_percentiles`, `productivity`, `workload`, `csat_breakdown` and the previous period's `prev_*`). escalated-laravel sends it `metrics` and `percentiles`, which the screen does not read.
- The advanced screens also answer at escalated-laravel's paths and names, which the dashboard links to: `{prefix}/admin/reports/sla-trends`, `response-times`, `resolution-times` and `agent-ranking` (`escalated.admin.reports.sla-trends|response-times|resolution-times|agent-ranking`). The `/reports/advanced/...` routes and their names stay.
- The shared `Admin/Settings/CsatSettings` page, which the CSAT report links to: `GET|POST {prefix}/admin/settings/csat` (`escalated.admin.settings.csat`, `.update`) for `csat_question_text`, `csat_scale` (`1-3`, `1-5`), `csat_delivery_trigger` (`on_resolve`, `delayed`, `manual`) and `csat_delay_hours` (0 to 168). As in escalated-laravel, the settings are stored; the rating flow does not read them yet.

- The shared `Admin/Settings/DataRetention` page, as escalated-laravel's DataRetentionController: `GET|POST {prefix}/admin/settings/data-retention` (`escalated.admin.settings.data-retention`, `.update`) for `retention_closed_tickets` and `retention_attachments` (`never`, `1_year`, `2_years`, `3_years`, `5_years`), `retention_audit_logs` (`never`, `90_days`, `180_days`, `365_days`) and `retention_user_data_gdpr` (stored only), with a `purgePreview` of `{tickets, attachments, audit_logs}`.
- `node ace escalated:purge-expired [--dry-run] [--force]`, as escalated-laravel's PurgeExpiredDataCommand: closed tickets past their period are soft-deleted (`deleted_at`), or deleted with `--force`; attachments past theirs are deleted with their files; audit log entries past theirs are deleted; tickets soft-deleted over 30 days ago are deleted for good, with their attachments' files (their replies, activities and other rows go through the existing `ON DELETE CASCADE`); expired guest verification codes are deleted.
- The shared `Admin/Settings/EmailSettings` page, as escalated-laravel's EmailSettingsController: `GET|POST {prefix}/admin/settings/email` (`escalated.admin.settings.email`, `.update`) stores the channel's `addresses` (`[{email, display_name, department_id, dkim_status}]`, setting `email_addresses`) and `defaultReplyAddress` (setting `default_reply_address`, changed only when sent). As in Laravel they are stored only: outbound mail does not read them and DKIM is not checked.
- The shared `Admin/Settings/DatabaseConnection` page, read-only: `GET {prefix}/admin/settings/database` (`escalated.admin.settings.database`) describes each Lucid connection (`name`, `driver`, `database` without credentials, `is_current`, `is_host_default`, `reachable`, `migrated`, `ticket_count`, `error`), with `current` (the `connection` from config/escalated.ts, or the default), `hostDefault`, `tablePrefix` and `pinnedByConfig: true`, since this package cannot switch connections at runtime. `POST .../database/test` (`.database.test`) answers one connection's description as JSON (422 for a name that is not configured); `POST .../database` (`.database.update`) goes back with an `error` flash and changes nothing.
- The guest policy save flashes `Guest policy updated.`, as escalated-laravel does.

### Security
- **Stored secrets are no longer sent to admin pages.** The webhook edit page received the webhook's signing secret. It now gets `has_secret` instead, as do the webhook index and delivery-log pages, and `Webhook` no longer serializes `secret`. The general settings page showed the first three characters of the Mailgun signing key, Postmark inbound token and IMAP password; they are now masked completely. The import index and progress pages already left the source-platform credentials out; they are now built from an explicit field list (`ImportJob.toPageProps()`, with the newest 50 errors), and `ImportJob` no longer serializes `credentials`; the import run still reads them server-side. `TwoFactor` (`secret`, `recovery_codes`) and `ApiToken` (`token` hash) no longer serialize their secrets either, though no page sent them. This package has no SSO settings page.

### Fixed
- Import mode (`ImportContext`) was a process-wide flag. While an import ran, every request in the process saw it, so live tickets lost their notifications, SLA clocks and webhooks for the length of the import. It now holds only inside the import's own async context.
- Import mode now also holds back SLA policy attachment (including the targeted-SLA hook on ticket create), breach and warning checks, escalation rules and automations, as escalated-laravel's ImportContext does.
- An imported ticket's status or priority this package does not know is saved as open / medium, as escalated-laravel does, and a ticket with no description takes its subject.
- The SLA policy and department edit forms received `policy` / `department` with camelCase keys (`isActive`, `firstResponseHours`, ...), which the shared forms do not read, so fields such as `is_active`, the hour targets and `business_hours_only` opened at their defaults. They now get snake_case keys, as escalated-laravel serialises them, including `business_schedule_id`.
- A business-hours deadline counted against `sla.businessHours` was stored as that zone's wall time where the column has no offset (SQLite, MySQL `DATETIME`), so on a server whose zone differs from it the deadline moved by the difference. It is stored in the ticket's zone, as calendar-hours deadlines are.
- The SLA trends screen failed on every database: it queried `sla_first_response_due_at` and `sla_resolution_due_at`, which do not exist. It reads `first_response_due_at` and `resolution_due_at`.
- The shared `Customer/KnowledgeBase/Index` and `Customer/KnowledgeBase/Article` pages, as escalated-laravel's Customer\KnowledgeBaseController: `GET {prefix}/kb` (`escalated.customer.kb.index`: published articles as a Laravel paginator of 15 with `category` and `view_count`, root `categories` with published `articles_count`, `filters` for `search` and `category`, `feedbackEnabled`), `GET {prefix}/kb/:slug` (`escalated.customer.kb.show`: the `article` with `body` and `category`, counted as a view, and up to five `related`) and `POST {prefix}/kb/:slug/feedback` (`escalated.customer.kb.feedback`, `{helpful}`; 404 while `knowledge_base_feedback_enabled` is off). They sit under the customer middleware and the existing `KnowledgeBaseGuard`, now registered as the `knowledgeBaseGuard` named middleware: 404 while `knowledge_base_enabled` is off (the default), 403 without a user when `knowledge_base_public` is off. As in Laravel, the article `body` is passed as stored, and the page renders it as HTML.
- The shared `Admin/Roles/Index` and `Admin/Roles/Form` pages, as escalated-laravel's RoleController: `{prefix}/admin/roles` with `escalated.admin.roles.index|create|store|edit|update|destroy`. The index carries each role's `users_count` and `is_system`; the form gets `permissions` grouped by `group` and, on edit, `role.permissions`. A new role's `slug` comes from its name (`agent-2` when taken). System roles cannot be deleted. Unknown permission ids are ignored.
- The shared `Admin/Capacity/Index` page, as escalated-laravel's CapacityController: `GET {prefix}/admin/capacity` (`escalated.admin.capacity.index`) lists each agent's channel, `max_concurrent`, `current_count` and `load_percentage`, and `PUT {prefix}/admin/capacity/:id` (`escalated.admin.capacity.update`) sets `max_concurrent` (1 to 999).
- The shared `Admin/Webhooks/Form` page: `GET {prefix}/admin/webhooks/create` (`escalated.admin.webhooks.create`) and `GET {prefix}/admin/webhooks/:webhook/edit` (`escalated.admin.webhooks.edit`), with `webhook` (including `secret`, which the form posts back) and `availableEvents`, as escalated-laravel. The Webhooks index linked to both routes, which did not exist, so the page failed to render its links.

### Changed
- Creating or updating a webhook redirects to the webhooks index, as escalated-laravel, instead of back. Webhook index rows also carry the latest delivery as `deliveries[0]`, which the shared page reads; `latest_delivery` stays.

## [0.7.4] - 2026-10-21

### Upgrading
- Run the migrations (`0065_verified_guest_access`) and configure `@adonisjs/mail` (or `guestAccess.sendCode`) so codes can be sent. Deploy a shared frontend with the email-code step: older clients cannot create guest tickets or start widget chats.
- Permanent guest links (`{prefix}/guest/<64-hex token>`, `GET /widget/tickets/<token>`) stop working; guests renew through lookup. `guestAccess.legacyTokens: true` keeps them working during a transition. `POST /widget/tickets` returns `guest_access_token` and `expires_at` instead of `guest_token`. `TicketService.createGuest` takes `verified: true` from callers that consumed a code.
- Stored names are read as aliases, not rewritten: `ticket.replied`, `internal_note.added`, `internal_note.created`, `tag.added`, `ticket.tagged`, `tag.removed`, `ticket.untagged`, `chat.session_started` and `chat.session_ended`. A webhook subscribed under one of them receives the event under the canonical name, and a workflow stored with `ticket.replied` runs on `reply.created`. The admin pages show them, and saving stores them, under the canonical names.
- `ChatMessageData.authorId` and the chat transfer agent ids are typed `UserId`, as elsewhere.
- Set `storage.disk` to a disk that is not publicly served. The old stub set `disk: 'public'`; with that, new files are still written to a public disk. Files already on the public disk stay readable through the download route; stop serving or move them as `docs/private-attachments.md` describes.
- `Attachment#url()` (the Drive URL) and the `downloadUrl` getter are removed. `url` is now the signed download link, set by `signAttachments()` / `attachmentDownloadUrl()` from `support/attachment_access`. `disk` and `path` are no longer serialized. Clients that cached attachment URLs must refetch the ticket.

### Added
- Ticket merge, as escalated-laravel's TicketMergeService: `POST {prefix}/admin/tickets/:ticket/merge` (`{target_reference}`) moves the source's replies to the target, leaves a system note on both, closes the source with `merged_into_id` pointing at the target (new column, migration 0066), all in one transaction, then emits the source's `TICKET_STATUS_CHANGED` and `TICKET_CLOSED`. `GET {prefix}/admin/tickets/merge-search?q=` finds unmerged tickets by reference or subject. A merged ticket cannot be merged again or chosen as a target.
- Routes for the existing ticket-link and side-conversation services, under the names the shared frontend calls: `escalated.admin.tickets.links.index|store|destroy` and `escalated.admin.tickets.side-conversations.index|store|reply|close`. A link or conversation is reached only through its own ticket.
- Routes for the mentions controller: `GET {prefix}/agent/mentions`, `POST {prefix}/agent/mentions/read` and `GET {prefix}/admin/agents/search` (the mention picker's default endpoint).
- Live chat emits `escalated:chat:started`, `escalated:chat:assigned` (new), `escalated:chat:transferred`, `escalated:chat:message` and `escalated:chat:ended`. They were defined but never emitted. Webhooks can subscribe to `chat.started`, `chat.assigned`, `chat.transferred`, `chat.message` and `chat.ended`; the payload carries `ticket` and `chat.session_id` (plus `agent_id`, `chat.from_agent_id`/`to_agent_id`, or `chat.reply_id`/`author_type` where they apply). Workflows can trigger on `chat.started` and `chat.ended`, as in Laravel.

### Security
- Verified guest access, as in escalated-laravel (see `docs/guest-access.md`). `POST {prefix}/guest/verification` and `{prefix}/widget/verification` email an eight-digit code (purposes `ticket`, `chat`, `lookup`; 10 minutes; 5 guesses; single use; 3 codes per mailbox per client IP and 10 per mailbox per hour, 429 with `Retry-After`). The guest form, `POST /widget/tickets` and `POST /widget/chat/start` require one. Guest tickets are opened by expiring grants (default 24 h, `guestAccess.ttlMinutes`) whose nonce is stored only as a hash; renewal rotates them and changing the guest email revokes them. `POST {prefix}/guest/lookup` and `{prefix}/widget/lookup` renew access by reference and proven email. `GET /widget/tickets/:reference` answers with `Authorization: Bearer <grant>`. Widget `/config` returns `guest_verification_required: true` and `status_lookup_enabled: true`. Guest answers are `no-store` and `no-referrer`, and the guest page no longer carries ticket or reply metadata. Guest attachment links are bound to the active grant.
- Attachments are private, as in escalated-laravel. Pages and the API no longer carry a Drive URL; an attachment serializes with `url`, a link to the new `GET {prefix}/attachments/:attachment/download` route (`escalated.attachments.download`) that expires after `storage.downloadTtlMinutes` (default 10, 1 to 60). The route checks current access on every request: agents and admins who can see the ticket get everything, the requester gets the ticket's and its public replies' attachments (never internal notes), guests only links issued by the guest page and bound to the ticket's current guest token, and API clients their bearer token (a bad bearer is 401, with no fallback to the session). Downloads are `attachment` with a sanitised name, `nosniff`, `private, no-store`, `no-referrer`, and `application/octet-stream` unless the type is PDF, GIF, JPEG, PNG, WebP or plain text. See `docs/private-attachments.md`.
- New uploads and inbound email attachments are written with private visibility to `storage.disk`, or the application's default Drive disk when unset (it was hard-coded to `public`).

### Changed
- Webhooks and workflow triggers use the shared event vocabulary (escalated-developer-context ADR 2026-10-21). The names live in `src/support/event_names.ts`. Webhooks already sent the canonical ticket, reply, note, tag and SLA names, so nothing changes for those deliveries.

### Fixed
- Uploads were moved with the Drive 1 `moveToDisk` signature, which Drive 4 reads differently: files landed on the wrong disk and path. They are now written where the attachment row says.
- Ticket-level attachments (stored on create) are loaded as `ticket.attachments` on the agent, admin, customer and guest pages.

## [0.7.3] - 2026-10-20

### Changed
- The bundled widget is now `@escalated-dev/escalated` 0.12.3. It keeps its script settings when `embed.js` is placed in the page `<head>`, and Enter no longer picks a stale mention suggestion.

### Fixed
- `userModel: '#models/user'` (the config stub's default) now resolves. The package imported the alias itself, which Node resolves against the package's own package.json, so it always failed: API tokens answered 401, inbound replies from registered customers opened new guest tickets, restricted ticket access failed with 500 and the widget named every agent "Support". Every lookup now goes through one helper that imports via the application's importer (`app.import()`), so it resolves the host's import map. `userModel` also accepts the model class or a loader such as `() => import('#models/user')`.
- The widget's `POST /widget/tickets` now honours the guest tickets setting (403 when off, as Laravel), validates email format and field lengths, and creates the ticket through the guest ticket path shared with the guest form: guest policy, contact, default SLA and `TICKET_CREATED` (so notifications, webhooks, workflows and plugins see widget tickets). A disabled widget answers 403 here too. Mailbox verification, which Laravel requires, is not implemented in this package yet.
- The guest form's tokens are 64 hex characters, so the redirect to the guest ticket page no longer 404s when a random token contained `-` or `_`.
- The `guest_user` guest policy records the user model's class name and the user's own key (UUID and string keys included), instead of the config's import path and an int-parsed key. A key that names no user falls back to unassigned.
- A customer opening, replying to, closing or reopening someone else's ticket gets 403 instead of 500. Owner keys compare as strings.
- The admin settings page shows and saves `widget_enabled`, so the widget can be switched off. It still defaults to on.

## [0.7.2] - 2026-10-19

## [0.7.1] - 2026-10-19

### Changed
- The bundled widget is now `@escalated-dev/escalated` 0.12.2. It hides its Check Status tab when `/config` returns `status_lookup_enabled: false`.

- Add cross-origin widget embedding. List the sites that may embed the widget in `widget.allowedOrigins` (`ESCALATED_WIDGET_ALLOWED_ORIGINS`) or the `widget_allowed_origins` admin setting; their requests to the widget routes get CORS headers (including on 4xx and 429), run as guests, and can skip shield's CSRF check through `isWidgetCsrfExempt` in `csrf.exceptRoutes`. Widget tickets and live chats store sanitised host `metadata` (with `embedded_on` set from the Origin), `/widget/config` returns `accepts_metadata: true`, and `{prefix}/widget/embed.js` serves the standalone widget bundle. Nothing changes until an origin is listed. See `docs/embedding-the-widget.md`.
- Align the widget routes with the shared widget's API (see "The widget API" in `docs/embedding-the-widget.md`). `/widget/config` adds `enabled`, `color`, `position`, `greeting`, active `departments`, `kb_enabled`, `guest_tickets_enabled` and `status_lookup_enabled: false`, and a disabled widget now answers 403 `{ enabled: false }` instead of 404. Article results add `excerpt`, and an article's fields are also returned at the top level. Widget tickets return `reference` and `message` and keep an active `department_id`. Live chats start without a first message, return `id` (the visitor token), `messages` and `agent`, and gain `GET`/`POST /widget/chat/:id/messages`; refusals carry `message` next to `error`. Existing keys and routes are unchanged.
- Add opt-in department/account ticket visibility across web, API, widget, reports and bulk paths, with account resolvers, account/type rule conditions and targeted SLA policies.

All notable changes to this project will be documented in this file.


## [0.7.0] - 2026-10-08

This release changes how inbound email is matched to tickets. Read
**Upgrading** before deploying.

### Upgrading

- **Inbound replies are accepted only from the ticket's requester.** A matched email becomes a reply only when `From` is the ticket's guest email or the requester user's email, and it is posted as that requester. A `From` address that belongs to another host user (for example an agent answering a notification by email) no longer posts as that user: the email opens a new ticket for its sender, and it no longer reopens a resolved or closed ticket. Agents should reply in the app.
- **New config: `inboundEmail.replySecret` (`ESCALATED_INBOUND_REPLY_SECRET`).** Set it to sign the Reply-To address on outbound notifications. Once it is set, only that signed address links inbound mail to a ticket, and replies to mail sent without it open new tickets. Without it, subject and `In-Reply-To` / `References` matching is kept (still subject to the requester check).
- **Guest endpoints are rate-limited per client IP** (5 tickets and 10 replies a minute by default; `POST guest`, `POST widget/tickets`, `POST guest/:token/reply`). Configure `guestRateLimit` (`enabled`, `ticketsPerMinute`, `repliesPerMinute`, and a shared `store` for multi-instance deployments). Behind a proxy, set `http.trustProxy` in `config/app.ts`, or every guest shares one budget.

### Security

- Inbound email that matched a ticket by subject reference or In-Reply-To/References was added as a reply whatever its sender, and a `From` address belonging to a host user posted the reply as that user. A matched email is now a reply only when `From` is the ticket's requester (the guest email or the requester user's email), and it is posted as that requester. Any other sender gets a new ticket of their own, and only an accepted reply reopens a resolved or closed ticket.
- New `inboundEmail.replySecret` (`ESCALATED_INBOUND_REPLY_SECRET`). When set, only the signed Reply-To address identifies a ticket.
- **Guest endpoints were not rate-limited.** Guest ticket creation (`POST guest`, `POST widget/tickets`) and guest replies (`POST guest/:token/reply`) are now limited per client IP, 5 tickets and 10 replies a minute by default, answering 429 with `Retry-After`. Replies are counted before the guest token is checked, so wrong-token requests count too. Configure with `guestRateLimit` (`enabled`, `ticketsPerMinute`, `repliesPerMinute`, and a shared `store` for multi-instance deployments). Behind a proxy, set `http.trustProxy` in `config/app.ts`, or every guest shares one IP.

## [0.6.2] - 2026-09-13

### Security
- **Any API token had full agent access.** `authenticateApiToken()` was applied without an ability, and it only checked abilities when one was named, so a token issued to a customer could list every ticket and an `agent` token could delete one.
  - Agent API routes now need the `agent` ability (or `*`) and an owner who is currently an agent or admin.
  - Deleting a ticket needs `admin` and an admin owner.
  - A route that names no ability gets the agent check (#143).
- **Any customer could rate any ticket.** `SatisfactionRatingController` never compared the ticket's requester to the user, so one customer could use up another customer's single rating. Other customers now get a 403 (#144).
- **Webhook URLs could point at internal addresses.**
  - Admin webhooks and the workflow `send_webhook` action refuse URLs that resolve to loopback, private-network, link-local or other non-public addresses. The check runs when a webhook is saved and again before every delivery and retry.
  - A blocked delivery is recorded in the delivery log and not retried.
  - Redirects are recorded as the response rather than followed.
  - Hosts that deliver to internal services can set `webhooks.allowPrivateUrls` (#145).

### Fixed
- **None of the package's Ace commands could be loaded.** The package exported its commands but no loader, and `configure` never registered one. As a result, none of these ran:
  - `escalated:run-escalations`
  - `escalated:run-automations`
  - `escalated:wake-snoozed-tickets`
  - newsletter dispatch
  - chat cleanup

  `@escalated-dev/escalated-adonis/commands` is now a loader backed by a committed `commands.json` index (`npm run index:commands`), and `configure` adds it to `adonisrc.ts`. **Apps configured before this release need to add the loader by hand**; the README's new "Scheduled commands" section shows how and lists the schedule for each command. The README also named the snooze command `wake_snoozed_tickets`; it is `wake-snoozed-tickets` (#142).
- **SLA breaches were never flagged.** `SlaService.checkBreaches()` and `checkWarnings()` had no callers, so `escalated:sla:breached` and `escalated:sla:warning` never fired. The new `escalated:check-sla` command runs both, with `--warning-minutes` (default 30) (#142).
- **Webhooks, plugin hooks and custom-action notes never received events.** The provider imported `@adonisjs/core/services/emitter` during `boot()`, before AdonisJS assigns it. The subscription threw, and a silent `catch {}` swallowed the error. They now take the emitter from the container, and a failed subscription logs a warning (#146).

## [0.6.1] - 2026-09-13

### Fixed
- **No guarded route reached its controller.** `start/routes.ts` attached Escalated's middleware to route groups as lazy imports and the host middleware from config as strings, and AdonisJS 7 runs neither. A lazy import was called as the middleware itself, never called `next()`, and ended the request in an empty 200: every API, widget and newsletter route, and the admin and agent routes whenever a host configured no string middleware. A string has no `handle`, so with the stub's `adminMiddleware: ['auth']` every admin, agent and customer route answered 500. Plugin endpoint routes were attached the same way.

  Every group now uses references built with `router.named()`, and the middleware names in config are resolved from the host's `start/kernel.ts`. A name the kernel does not define makes route registration throw with a message naming it, rather than leaving routes unguarded. Existing `['auth']` configs keep working.

- **The workflow admin screen had no routes, and a saved workflow never ran.** Nothing in `start/routes.ts` pointed at `AdminWorkflowsController`, so none of the `escalated.admin.workflows.*` names the shared builder calls resolved. Behind them, the controller answered with JSON an Inertia form cannot consume, validated nothing, stored omitted conditions as `{}`, which matched no ticket, and had no create page. Nothing called `WorkflowEngine.processEvent`, and the form offered twelve trigger events, seven of which the package never fires.

  The screen now follows escalated-developer-context `domain-model/workflow-admin-contract.md`. The `index`, `create`, `store`, `edit`, `update`, `destroy`, `toggle`, `reorder` and `logs` routes are named `escalated.admin.workflows.*`. A workflow needs a `name`, a `trigger_event` this backend fires and at least one `{type, value}` action, and omitted conditions are stored as `{all: []}`. Saves, toggle, reorder (`workflow_ids`) and delete redirect, with validation errors flashed where the Inertia adapter reads them, and the Form gets `workflow`, `trigger_events`, `action_types` and `operators`. The provider subscribes the engine to the five canonical triggers, and a failing workflow never breaks the ticket change that emitted the event. `insert_canned_reply` writes a public reply, and an empty `any` list matches every ticket. `delay` and `send_notification` are no longer offered, but stored workflows that use them still run.

- **Every ticket created through the model came back without an id.** `Ticket` declared `selfAssignPrimaryKey = true` on an auto-increment table, so Lucid never read back the id the database assigned. `TicketService.create` failed writing the ticket's first activity, before it emitted `ticket.created`, and guest and widget tickets, chat sessions, inbound email, `splitTicket` and the importer were all left holding a ticket with no id. The flag is gone, and a test fails if any model self-assigns the key of an auto-increment table.

- **A fresh install stopped at migration 0048.** `0048_create_escalated_agent_skills` called `table.smallInteger`, which knex does not have, so `node ace migration:run` threw on every database and 0049 through 0063 never applied: skill routing, newsletters, ticket subjects, agent capacity, ticket links, side conversations, webhooks, two-factor, the knowledge base and audit logs. It now calls `table.smallint`, keeping the `NOT NULL` default of `3`, and a database that already recorded 0048 is unaffected. A new test runs every migration on an empty database.

- **Ten screens rendered blank.** They rendered page names with no component behind them in `@escalated-dev/escalated`, and Inertia resolves such a name to nothing rather than to an error, so each returned 200 and an empty panel. `Admin/Import/Create` and `Admin/Import/Show` now render `Admin/Import/Index` and `Admin/Import/Progress`, and `Admin/Workflows/Show` renders `Admin/Workflows/Form`. `Auth/TwoFactorChallenge`, rendered after a password is accepted, now ships in `@escalated-dev/escalated` 0.11.4, so it is no longer a dead end for anyone with two-factor enabled. The six advanced reports stay blank: their endpoints pass `{ data, filters }` where the components take flat props.

### Changed
- Dependabot: `eslint` 10.9.1 to 10.10.0 (#132) and `@adonisjs/vite` 6.0.1 to 6.0.2 (#133), both dev dependencies.

### Added
- **`tests/page_name_parity.test.js`**, asserting every page name this package renders resolves to a component. It reads the manifest from the installed `@escalated-dev/escalated` rather than a vendored copy, so it cannot go stale, and it fails if its list of known-blank names still excuses one that has since been fixed.

## [0.6.0] - 2026-09-12

### Added
- **Configurable database connection.** `connection` on the Escalated config names the Lucid connection Escalated's own tables live on. Omitted means the host's default connection, which is the historical behaviour and leaves an unconfigured host unchanged.

  Every model now extends `EscalatedBaseModel`, which exposes `connection` as a getter rather than the static string Lucid normally takes — the config is not loaded when the model classes are defined, and Lucid reads `modelConstructor.connection` when it resolves a query client, so a getter satisfies it at exactly the right moment. A test enumerates `src/models` and fails if a model is added that does not extend the base.

  Direct query-builder access in the workflows controller and the department pivot now binds `db` to Escalated's connection, which also picks up `escalated_workflow_logs`. The importer's user lookup deliberately stays on the default connection: that table belongs to the host.

  Run migrations against the same connection with `node ace migration:run --connection=support`.

### Fixed
- **Average first-response reporting was broken on SQLite.** The dialect check compared against `'sqlite'`, which is not a name any driver reports — Knex returns `'sqlite3'` — so the branch never fired and SQLite hosts were handed MySQL's `TIMESTAMPDIFF`, a function SQLite does not have. Typing the connection surfaced it. Now matches `sqlite3`, `better-sqlite3` and `libsql`.

### Added
- Ticket subjects: attach host-app entities (Project, Customer, asset, …) that a ticket is *about*, distinct from the requester. `TicketSubject` contract + `ticketSubjects` config (`types` allowlist, `resolver` for presentation). `TicketSubjectLink` model, `attachSubject` / `detachSubject` / `syncSubjects` on `Ticket`, agent/admin attach/detach routes, API/detail serialization as `subjects[]`.
- Admin Users management page (`GET /support/admin/users`) and role-toggle endpoint (`PATCH /support/admin/users/:user/role`) that mirror the Laravel reference (escalated-laravel#94). Admins can grant or revoke the `is_admin` / `is_agent` flags on host users; admins cannot demote themselves, and revoking the agent flag from a user who is also admin cascades to clear admin too. Renders the shared `Escalated/Admin/Users/Index` Inertia page.
- Consume translations from the central `@escalated-dev/locale` npm package. The package is loaded as the base layer, this package's `resources/lang/{locale}/messages.json` files are deep-merged on top as overrides, and host apps can drop further overrides into `resources/lang/overrides/{locale}/messages.json`. See `resources/lang/overrides/README.md` for the layering rules and a sample `config/i18n.ts` chain for `@adonisjs/i18n` v3+.

### Changed
- **BREAKING**: Upgraded to AdonisJS v7. Host applications must be on AdonisJS Core ^7.0, Lucid ^22.0, Auth ^10.0, Inertia ^4.0, Drive ^4.0, Mail ^10.0, and Node.js 24+. Bundles Dependabot updates #58 (auth 10.1), #59 (drive 4.0), #60 (lucid 22.4), #62 (session 8.1).
- Internal: replaced `response.redirect().toRoute(name)` with a small `redirectToRoute` helper to bypass v7's strict, host-augmented `RoutesList` types in plugin code (runtime semantics unchanged).
- Internal: widened `InertiaPages` via `@adonisjs/inertia/types` augmentation so the package's render calls type-check standalone.

## [0.4.0] - 2026-02-09

### Added
- Full v0.4.0 feature parity: three role types (Customer, Agent, Admin), bulk actions, macros, followers, CSAT ratings, pinned notes, quick filters, presence indicators, and enhanced agent dashboard
- SSO service with SAML and JWT validation
- Full automation system with configurable conditions, actions, and admin CRUD
- Ticket type categorization field with filtering
- RBAC migration, models, and permission seeder
- In-process plugin bridge for AdonisJS backend (no subprocess overhead)
- WordPress-style plugin/extension system with npm discovery and source badges
- Plugin SDK section in README and plugin authoring guide
- Import framework for bulk data ingestion
- Multi-language (i18n) support with EN, ES, FR, DE translations
- REST API layer with token auth, rate limiting, and full ticket CRUD
- Node test suite for escalated-adonis
- GitHub Actions CI build pipeline
- `show_powered_by` setting
- Make Inertia UI optional with `ui.enabled` config

### Fixed
- Reject inbound webhooks when auth credentials are missing
- Validate package structure instead of tsc build

### Changed
- Plugin system refactored to `app/plugins/escalated` with npm discovery and source badges
