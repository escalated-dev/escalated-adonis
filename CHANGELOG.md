# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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
