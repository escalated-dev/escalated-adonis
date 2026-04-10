<p align="center">
  <a href="README.ar.md">العربية</a> •
  <b>Deutsch</b> •
  <a href="../../README.md">English</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.it.md">Italiano</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.ko.md">한국어</a> •
  <a href="README.nl.md">Nederlands</a> •
  <a href="README.pl.md">Polski</a> •
  <a href="README.pt-BR.md">Português (BR)</a> •
  <a href="README.ru.md">Русский</a> •
  <a href="README.tr.md">Türkçe</a> •
  <a href="README.zh-CN.md">简体中文</a>
</p>

# Escalated for AdonisJS

[![Tests](https://github.com/escalated-dev/escalated-adonis/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-adonis/actions/workflows/run-tests.yml)
[![AdonisJS](https://img.shields.io/badge/adonisjs-v6-5A45FF?logo=adonisjs&logoColor=white)](https://adonisjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Ein vollständiges, einbettbares Support-Ticket-System für AdonisJS v6. Integrieren Sie es in jede App — erhalten Sie einen kompletten Helpdesk mit SLA-Tracking, Eskalationsregeln, Agenten-Workflows und einem Kundenportal. Keine externen Dienste erforderlich.

> **[escalated.dev](https://escalated.dev)** — Erfahren Sie mehr, sehen Sie Demos und vergleichen Sie Cloud- mit Self-Hosted-Optionen.

## Voraussetzungen

- AdonisJS v6 (Core ^6.0)
- @adonisjs/lucid ^21.0
- @adonisjs/auth ^9.0
- @adonisjs/inertia ^1.0
- @adonisjs/drive ^3.0 (for file attachments)
- @adonisjs/mail ^9.0 (optional, for notifications)
- Node.js 20+

## Installation

```bash
npm install @escalated-dev/escalated-adonis
```

Then run the configure command:

```bash
node ace configure @escalated-dev/escalated-adonis
```

This will:

1. Publish `config/escalated.ts` to your application
2. Register the `EscalatedProvider` in your `.adonisrc.ts`
3. Copy all database migration files to your `database/migrations/` directory

Run the migrations:

```bash
node ace migration:run
```

## Konfiguration

Edit `config/escalated.ts` to customize behavior:

```typescript
const escalatedConfig: EscalatedConfig = {
  // Hosting mode: 'self-hosted' | 'synced' | 'cloud'
  mode: 'self-hosted',

  // Your app's user model import path
  userModel: '#models/user',

  // Route configuration
  routes: {
    enabled: true,
    prefix: 'support',
    middleware: ['auth'],
    adminMiddleware: ['auth'],
  },

  // Authorization callbacks
  authorization: {
    isAgent: (user) => user.isEscalatedAgent ?? false,
    isAdmin: (user) => user.isEscalatedAdmin ?? false,
  },

  // ... see config file for full options
}
```

### Autorisierung

The `isAgent` and `isAdmin` callbacks determine role-based access. You can use boolean properties, methods, or any async logic:

```typescript
authorization: {
  isAgent: async (user) => {
    // Check a database column
    return user.role === 'agent' || user.role === 'admin'
  },
  isAdmin: async (user) => {
    return user.role === 'admin'
  },
}
```

## Funktionen

- **Tickets:** Create, view, update, close, reopen tickets with status machine
- **Replies:** Threaded conversations with rich text and pinned notes
- **Departments:** Organize tickets by team with agent assignments
- **Tags:** Label and categorize tickets
- **SLA Policies:** First response and resolution time tracking with breach detection
- **Escalation Rules:** Automated ticket escalation based on configurable conditions
- **Canned Responses:** Pre-written reply templates (shared or per-agent)
- **Activity Log:** Full audit trail of all ticket changes
- **Attachments:** File uploads on replies with configurable storage
- **Notifications:** Webhook-based notifications with HMAC signing
- **Admin Settings:** Runtime-configurable settings stored in the database
- **Guest Tickets:** Anonymous ticket creation with 64-character token access
- **Inbound Email:** Mailgun, Postmark, and SES adapters with auto-threading and attachment processing
- **Three Role Types:** Customer, Agent, Admin with separate dashboards
- **Bulk Actions:** Batch status/priority/assignment/tag/department changes
- **Macros:** Multi-step automated actions (status + priority + reply in one click)
- **Followers:** Subscribe to ticket updates
- **CSAT Ratings:** Post-resolution satisfaction surveys (1-5 scale)
- **Quick Filters:** Pre-built filter shortcuts (My Tickets, Unassigned, Breached SLA, etc.)
- **Presence Indicators:** See who is viewing a ticket in real time
- **SSO:** SAML and JWT-based single sign-on
- **RBAC:** Role-based access control with granular permissions
- **Automation:** Configurable automation rules with conditions and actions
- **i18n:** Multi-language support (EN, ES, FR, DE)
- **Plugin System:** Extensible via TypeScript SDK plugins
- **REST API:** Token-authenticated API with rate limiting
- **Import Framework:** Bulk data import support
- **Ticket Splitting:** Split a reply into a new standalone ticket while preserving the original context
- **Ticket Snooze:** Tickets mit Voreinstellungen schlummern lassen (1h, 4h, morgen, nächste Woche); der Ace-Befehl `node ace escalated:wake_snoozed_tickets` weckt sie automatisch nach Zeitplan
- **Saved Views / Custom Queues:** Save, name, and share filter presets as reusable ticket views
- **Embeddable Support Widget:** Leichtgewichtiges `<script>`-Widget mit KB-Suche, Ticket-Formular und Statusprüfung
- **Email Threading:** Outbound emails include proper `In-Reply-To` and `References` headers for correct threading in mail clients
- **Branded Email Templates:** Configurable logo, primary color, and footer text for all outbound emails
- **Real-time Broadcasting:** Opt-in-Broadcasting über AdonisJS Transmit mit automatischem Polling-Fallback
- **Knowledge Base Toggle:** Enable or disable the public knowledge base from admin settings

## Architektur

### Models (14)

| Model | Table | Description |
|-------|-------|-------------|
| `Ticket` | `escalated_tickets` | Core ticket with status machine, guest support |
| `Reply` | `escalated_replies` | Threaded replies with pinning and internal notes |
| `Department` | `escalated_departments` | Team organization with agent pivot |
| `Tag` | `escalated_tags` | Ticket categorization |
| `SlaPolicy` | `escalated_sla_policies` | SLA time targets per priority |
| `EscalationRule` | `escalated_escalation_rules` | Automated escalation conditions/actions |
| `CannedResponse` | `escalated_canned_responses` | Reply templates |
| `TicketActivity` | `escalated_ticket_activities` | Audit log entries |
| `Attachment` | `escalated_attachments` | File attachments (polymorphic) |
| `Macro` | `escalated_macros` | Multi-step action sequences |
| `SatisfactionRating` | `escalated_satisfaction_ratings` | CSAT ratings |
| `InboundEmail` | `escalated_inbound_emails` | Inbound email log |
| `EscalatedSetting` | `escalated_settings` | Key-value runtime settings |

### Services (8)

| Service | Description |
|---------|-------------|
| `TicketService` | Create, update, transition status, reply, add notes, manage tags/departments |
| `AssignmentService` | Assign/unassign agents, auto-assign (least-workload strategy) |
| `SlaService` | Attach policies, check breaches, calculate due dates with business hours |
| `EscalationService` | Evaluate rules, find matching tickets, execute automated actions |
| `NotificationService` | Send webhook notifications with HMAC-SHA256 signing |
| `AttachmentService` | Store/delete file attachments via AdonisJS Drive |
| `MacroService` | Execute multi-step macro actions on tickets |
| `InboundEmailService` | Process inbound emails, match to tickets, create replies |

### Controllers (16)

| Controller | Role | Description |
|------------|------|-------------|
| `CustomerTicketsController` | Customer | List, create, view, reply, close, reopen |
| `AgentDashboardController` | Agent | Dashboard with stats and quick filters |
| `AgentTicketsController` | Agent | Full ticket management with all actions |
| `AdminTicketsController` | Admin | Same as agent plus delete capability |
| `AdminDepartmentsController` | Admin | CRUD for departments |
| `AdminTagsController` | Admin | CRUD for tags |
| `AdminSlaPoliciesController` | Admin | CRUD for SLA policies |
| `AdminEscalationRulesController` | Admin | CRUD for escalation rules |
| `AdminCannedResponsesController` | Admin | CRUD for canned responses |
| `AdminMacrosController` | Admin | CRUD for macros |
| `AdminReportsController` | Admin | Reporting dashboard |
| `AdminSettingsController` | Admin | Runtime settings management |
| `BulkActionsController` | Agent/Admin | Batch ticket operations |
| `SatisfactionRatingController` | Customer | Submit CSAT ratings |
| `GuestTicketsController` | Public | Anonymous ticket creation and viewing |
| `InboundEmailController` | Webhook | Process inbound email from adapters |

### Middleware (3)

| Middleware | Description |
|------------|-------------|
| `EnsureIsAgent` | Verifies user is an agent (or admin) via config callback |
| `EnsureIsAdmin` | Verifies user is an admin via config callback |
| `ResolveTicket` | Resolves ticket by reference or ID, attaches to context |

## Inertia-Seitenkomponenten

All controllers render Inertia pages with the `Escalated/` prefix. Your Vue app must provide these page components:

### Kundenseiten
- `Escalated/Customer/Index` - Ticket list
- `Escalated/Customer/Create` - New ticket form
- `Escalated/Customer/Show` - Ticket detail with replies

### Agentenseiten
- `Escalated/Agent/Dashboard` - Agent dashboard
- `Escalated/Agent/Tickets/Index` - Ticket list with filters
- `Escalated/Agent/Tickets/Show` - Ticket detail with all actions

### Admin-Seiten
- `Escalated/Admin/Tickets/Index` - Admin ticket list
- `Escalated/Admin/Tickets/Show` - Admin ticket detail
- `Escalated/Admin/Departments/Index` - Departments list
- `Escalated/Admin/Departments/Create` - New department
- `Escalated/Admin/Departments/Edit` - Edit department
- `Escalated/Admin/Tags/Index` - Tags management
- `Escalated/Admin/SlaPolicies/Index` - SLA policies list
- `Escalated/Admin/SlaPolicies/Create` - New SLA policy
- `Escalated/Admin/SlaPolicies/Edit` - Edit SLA policy
- `Escalated/Admin/EscalationRules/Index` - Escalation rules list
- `Escalated/Admin/EscalationRules/Create` - New escalation rule
- `Escalated/Admin/EscalationRules/Edit` - Edit escalation rule
- `Escalated/Admin/CannedResponses/Index` - Canned responses
- `Escalated/Admin/Macros/Index` - Macros management
- `Escalated/Admin/Reports` - Reports dashboard
- `Escalated/Admin/Settings` - Settings management

### Gastseiten
- `Escalated/Guest/Create` - Guest ticket form
- `Escalated/Guest/Show` - Guest ticket view

## Routennamen

All routes are named with the `escalated.` prefix:

```
# Customer
escalated.customer.tickets.index
escalated.customer.tickets.create
escalated.customer.tickets.store
escalated.customer.tickets.show
escalated.customer.tickets.reply
escalated.customer.tickets.close
escalated.customer.tickets.reopen
escalated.customer.tickets.rate

# Agent
escalated.agent.dashboard
escalated.agent.tickets.index
escalated.agent.tickets.bulk
escalated.agent.tickets.show
escalated.agent.tickets.update
escalated.agent.tickets.reply
escalated.agent.tickets.note
escalated.agent.tickets.assign
escalated.agent.tickets.status
escalated.agent.tickets.priority
escalated.agent.tickets.tags
escalated.agent.tickets.department
escalated.agent.tickets.macro
escalated.agent.tickets.follow
escalated.agent.tickets.presence
escalated.agent.tickets.pin

# Admin
escalated.admin.reports
escalated.admin.tickets.index
escalated.admin.tickets.bulk
escalated.admin.tickets.show
escalated.admin.tickets.reply
escalated.admin.tickets.note
escalated.admin.tickets.assign
escalated.admin.tickets.status
escalated.admin.tickets.priority
escalated.admin.tickets.tags
escalated.admin.tickets.department
escalated.admin.tickets.macro
escalated.admin.tickets.follow
escalated.admin.tickets.presence
escalated.admin.tickets.pin
escalated.admin.settings
escalated.admin.settings.update
escalated.admin.departments.index
escalated.admin.departments.create
escalated.admin.departments.store
escalated.admin.departments.edit
escalated.admin.departments.update
escalated.admin.departments.destroy
escalated.admin.sla-policies.index
escalated.admin.sla-policies.create
escalated.admin.sla-policies.store
escalated.admin.sla-policies.edit
escalated.admin.sla-policies.update
escalated.admin.sla-policies.destroy
escalated.admin.escalation-rules.index
escalated.admin.escalation-rules.create
escalated.admin.escalation-rules.store
escalated.admin.escalation-rules.edit
escalated.admin.escalation-rules.update
escalated.admin.escalation-rules.destroy
escalated.admin.tags.index
escalated.admin.tags.store
escalated.admin.tags.update
escalated.admin.tags.destroy
escalated.admin.canned-responses.index
escalated.admin.canned-responses.store
escalated.admin.canned-responses.update
escalated.admin.canned-responses.destroy
escalated.admin.macros.index
escalated.admin.macros.store
escalated.admin.macros.update
escalated.admin.macros.destroy

# Guest (no auth)
escalated.guest.tickets.create
escalated.guest.tickets.store
escalated.guest.tickets.show
escalated.guest.tickets.reply
escalated.guest.tickets.rate

# Inbound Email (no auth)
escalated.inbound.webhook
```

## Ticket-Zustandsmaschine

Tickets follow a strict state machine:

```
open -> in_progress, waiting_on_customer, waiting_on_agent, escalated, resolved, closed
in_progress -> waiting_on_customer, waiting_on_agent, escalated, resolved, closed
waiting_on_customer -> open, in_progress, resolved, closed
waiting_on_agent -> open, in_progress, escalated, resolved, closed
escalated -> in_progress, resolved, closed
resolved -> reopened, closed
closed -> reopened
reopened -> in_progress, waiting_on_customer, waiting_on_agent, escalated, resolved, closed
```

## Datenbanktabellen (14)

All tables use the `escalated_` prefix by default (configurable):

1. `escalated_departments` + `escalated_department_agent` pivot
2. `escalated_sla_policies`
3. `escalated_tickets`
4. `escalated_replies`
5. `escalated_attachments`
6. `escalated_tags` + `escalated_ticket_tag` pivot
7. `escalated_ticket_activities`
8. `escalated_escalation_rules`
9. `escalated_canned_responses`
10. `escalated_settings`
11. `escalated_inbound_emails`
12. `escalated_macros`
13. `escalated_ticket_followers`
14. `escalated_satisfaction_ratings`

## Gemeinsame Inertia-Daten

The provider automatically shares the following data via Inertia on every request:

```typescript
{
  escalated: {
    prefix: 'support',           // Route prefix
    is_agent: false,             // Whether current user is an agent
    is_admin: false,             // Whether current user is an admin
    guest_tickets_enabled: true, // Whether guest tickets are enabled
  }
}
```

## Ereignisse

The package emits the following events that you can listen to:

| Event | Description |
|-------|-------------|
| `escalated:ticket:created` | New ticket created |
| `escalated:ticket:updated` | Ticket fields updated |
| `escalated:ticket:status_changed` | Status transition |
| `escalated:ticket:assigned` | Agent assigned |
| `escalated:ticket:unassigned` | Agent unassigned |
| `escalated:ticket:priority_changed` | Priority changed |
| `escalated:ticket:department_changed` | Department changed |
| `escalated:ticket:tags_added` | Tags added |
| `escalated:ticket:tags_removed` | Tags removed |
| `escalated:ticket:escalated` | Ticket escalated |
| `escalated:ticket:resolved` | Ticket resolved |
| `escalated:ticket:closed` | Ticket closed |
| `escalated:ticket:reopened` | Ticket reopened |
| `escalated:reply:created` | Reply added |
| `escalated:note:created` | Internal note added |
| `escalated:sla:breached` | SLA target breached |
| `escalated:rating:created` | CSAT rating submitted |

## Eingehende E-Mail

Enable inbound email processing by setting `inboundEmail.enabled: true` in your config. Point your email provider's webhook to:

```
POST /support/inbound/mailgun
POST /support/inbound/postmark
POST /support/inbound/ses
```

The system will:
1. Parse incoming email from the adapter's format
2. Match to existing tickets via subject pattern (`[ESC-00001]`) or In-Reply-To/References headers
3. Create a reply on existing tickets or create a new ticket
4. Process attachments (with blocked extension filtering)
5. Log the inbound email for audit trail

## Direkte Nutzung von Services

You can resolve services from the container for custom logic:

```typescript
import app from '@adonisjs/core/services/app'

const ticketService = await app.container.make('escalated.ticketService')
const ticket = await ticketService.create({
  subject: 'Help needed',
  description: 'I have a question...',
  priority: 'medium',
  channel: 'api',
}, { id: 1, type: 'User' }) // requester

const assignmentService = await app.container.make('escalated.assignmentService')
await assignmentService.autoAssign(ticket)
```

## Frontend-Paket

This package serves only the backend API via Inertia.js. The shared Vue 3 frontend components are provided by the `@escalated-dev/escalated` package, which is framework-agnostic and works with all Escalated backends (AdonisJS, Laravel, Rails, Django).

```bash
npm install @escalated-dev/escalated
```

## Plugin-SDK

Escalated unterstützt framework-agnostische Plugins, die mit dem [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk) erstellt werden. Plugins werden einmal in TypeScript geschrieben und funktionieren über alle Escalated-Backends.

### Plugins Installieren

```bash
npm install @escalated-dev/plugin-slack
npm install @escalated-dev/plugin-jira
```

### SDK-Plugins Aktivieren

Enable the plugin system in your `EscalatedProvider` config:

```typescript
// config/escalated.ts
const escalatedConfig: EscalatedConfig = {
  // ...
  plugins: {
    enabled: true,
    sdkEnabled: true,
  },
}
```

### Funktionsweise

Unlike other Escalated backends, AdonisJS runs SDK plugins **in-process** — no subprocess, no JSON-RPC overhead. Plugins are loaded directly into the Node.js runtime alongside your AdonisJS application, giving native performance and eliminating the need for a separate plugin runtime process.

### Eigenes Plugin Erstellen

```typescript
import { definePlugin } from '@escalated-dev/plugin-sdk'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  actions: {
    'ticket.created': async (event, ctx) => {
      ctx.log.info('New ticket!', event)
    },
  },
})
```

### Ressourcen

- [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk) — TypeScript SDK zum Erstellen von Plugins
- [Plugin Runtime](https://github.com/escalated-dev/escalated-plugin-runtime) — Laufzeit-Host für Plugins
- [Plugin Development Guide](https://github.com/escalated-dev/escalated-docs) — Vollständige Dokumentation

## Auch Verfügbar Für

- **[Escalated for Laravel](https://github.com/escalated-dev/escalated-laravel)** — Laravel Composer-Paket
- **[Escalated for Rails](https://github.com/escalated-dev/escalated-rails)** — Ruby on Rails Engine
- **[Escalated for Django](https://github.com/escalated-dev/escalated-django)** — Wiederverwendbare Django-App
- **[Escalated for AdonisJS](https://github.com/escalated-dev/escalated-adonis)** — AdonisJS v6-Paket (Sie sind hier)
- **[Escalated for Filament](https://github.com/escalated-dev/escalated-filament)** — Filament v3 Admin-Panel-Plugin
- **[Shared Frontend](https://github.com/escalated-dev/escalated)** — Vue 3 + Inertia.js UI-Komponenten

Gleiche Architektur, gleiche Vue-UI, gleiche drei Hosting-Modi — für jedes wichtige Backend-Framework.

## Lizenz

MIT
