# Changelog

All notable changes to this project will be documented in this file.

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
