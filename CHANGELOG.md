# Changelog

## [Unreleased]

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
