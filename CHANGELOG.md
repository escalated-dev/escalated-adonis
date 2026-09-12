# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
