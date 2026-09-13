# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
