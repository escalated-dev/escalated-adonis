<p align="center">
  <a href="docs/translations/README.ar.md">العربية</a> •
  <a href="docs/translations/README.de.md">Deutsch</a> •
  <b>English</b> •
  <a href="docs/translations/README.es.md">Español</a> •
  <a href="docs/translations/README.fr.md">Français</a> •
  <a href="docs/translations/README.it.md">Italiano</a> •
  <a href="docs/translations/README.ja.md">日本語</a> •
  <a href="docs/translations/README.ko.md">한국어</a> •
  <a href="docs/translations/README.nl.md">Nederlands</a> •
  <a href="docs/translations/README.pl.md">Polski</a> •
  <a href="docs/translations/README.pt-BR.md">Português (BR)</a> •
  <a href="docs/translations/README.ru.md">Русский</a> •
  <a href="docs/translations/README.tr.md">Türkçe</a> •
  <a href="docs/translations/README.zh-CN.md">简体中文</a>
</p>

# Escalated for AdonisJS

[![Tests](https://github.com/escalated-dev/escalated-adonis/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-adonis/actions/workflows/run-tests.yml)
[![AdonisJS](https://img.shields.io/badge/adonisjs-v7-5A45FF?logo=adonisjs&logoColor=white)](https://adonisjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A full-featured, embeddable support ticket system for AdonisJS v7. Drop it into any app — get a complete helpdesk with SLA tracking, escalation rules, agent workflows, and a customer portal. No external services required.

> **[escalated.dev](https://escalated.dev)** — Learn more, view demos, and compare Cloud vs Self-Hosted options.

## Requirements

- AdonisJS v7 (Core ^7.0)
- @adonisjs/lucid ^22.0
- @adonisjs/auth ^10.0
- @adonisjs/inertia ^4.0
- @adonisjs/drive ^4.0 (for file attachments)
- @adonisjs/mail ^10.0 (optional, for notifications)
- Node.js 24+

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

## Configuration

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

### Host user key type (UUID / string users)

Escalated stores references to your app's users (ticket requester, assignee,
reply author, etc.). By default those columns are integers. If your `User`
model's primary key is a **UUID or other string**, set
`ESCALATED_USER_KEY_TYPE` before running the Escalated migrations so the FK
columns are created as `varchar(255)` instead of `integer`:

```dotenv
# .env — one of: int (default) | bigint | uuid | string
ESCALATED_USER_KEY_TYPE=uuid
```

It is read from the environment (not the config object) because Lucid
migrations run before app config is fully available. Existing integer-keyed
installs need no change — the default (`int`) produces the same schema as
before. All Escalated code paths accept a host user id as either a `number` or
a `string` (`UserId`).

### Authorization

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

### Ticket subjects

A ticket has a **requester** (who raised it) and a **subject line** (free text). Tickets can also be *about* host-app entities — a Project, Customer, asset — that are not people. Attach them as ticket **subjects** so agents see what the ticket concerns and can jump into your app.

Implement the `TicketSubject` contract on any host model (or resolve presentation via config):

```typescript
import type { TicketSubject } from '@escalated-dev/escalated-adonis'

export class Project implements TicketSubject {
  ticketSubjectTitle() {
    return this.name
  }
  ticketSubjectSubtitle() {
    return `Project · ${this.customerName}`
  }
  ticketSubjectUrl() {
    return `/projects/${this.id}`
  }
  ticketSubjectColor() {
    return '#2563eb'
  }
  ticketSubjectIcon() {
    return 'folder'
  }
}
```

Attach, detach, or sync on a ticket (several subjects allowed; `subject_id` is stored as a string):

```typescript
await ticket.attachSubject('Project', project.id, 'project')
await ticket.detachSubject('Project', project.id)
await ticket.syncSubjects([
  { type: 'Project', id: project.id, role: 'primary' },
  ['Customer', customer.id, 'account'],
])
```

Configure allowed types and a resolver for API/UI serialization:

```typescript
ticketSubjects: {
  types: ['Project', 'Customer'],
  resolver: async (type, id) => {
    if (type === 'Project') {
      const row = await Project.find(id)
      return row ?? null
    }
    return null
  },
},
```

Agent/admin routes: `POST …/tickets/:ticket/subjects` (`type`, `id`, optional `role`) and `DELETE …/tickets/:ticket/subjects/:linkId`. The API only accepts allowlisted types; programmatic `attachSubject()` allows any type when the allowlist is empty.

Each subject is serialized as `{ type, id, role, title, subtitle, url, color, icon, missing }` (fallback title `type#id` when the resolver is absent or returns null).

## Features

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
- **i18n:** Multi-language support sourced from the central `@escalated-dev/locale` npm package, with optional per-host overrides under `resources/lang/overrides/`
- **Plugin System:** Extensible via TypeScript SDK plugins
- **REST API:** Token-authenticated API with rate limiting
- **Import Framework:** Bulk data import support
- **Ticket Splitting:** Split a reply into a new standalone ticket while preserving the original context
- **Ticket Snooze:** Snooze tickets with presets (1h, 4h, tomorrow, next week); `node ace escalated:wake_snoozed_tickets` Ace command auto-wakes them on schedule
- **Saved Views / Custom Queues:** Save, name, and share filter presets as reusable ticket views
- **Embeddable Support Widget:** Lightweight `<script>` widget with KB search, ticket form, and status check
- **Email Threading:** Outbound emails include proper `In-Reply-To` and `References` headers for correct threading in mail clients
- **Branded Email Templates:** Configurable logo, primary color, and footer text for all outbound emails
- **Real-time Broadcasting:** Opt-in broadcasting via AdonisJS Transmit with automatic polling fallback
- **Knowledge Base Toggle:** Enable or disable the public knowledge base from admin settings

## Architecture

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

## Inertia Page Components

All controllers render Inertia pages with the `Escalated/` prefix. Your Vue app must provide these page components:

### Customer Pages
- `Escalated/Customer/Index` - Ticket list
- `Escalated/Customer/Create` - New ticket form
- `Escalated/Customer/Show` - Ticket detail with replies

### Agent Pages
- `Escalated/Agent/Dashboard` - Agent dashboard
- `Escalated/Agent/Tickets/Index` - Ticket list with filters
- `Escalated/Agent/Tickets/Show` - Ticket detail with all actions

### Admin Pages
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

### Guest Pages
- `Escalated/Guest/Create` - Guest ticket form
- `Escalated/Guest/Show` - Guest ticket view

## Route Names

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
escalated.admin.skills.index
escalated.admin.skills.create
escalated.admin.skills.store
escalated.admin.skills.edit
escalated.admin.skills.update
escalated.admin.skills.destroy

# Guest (no auth)
escalated.guest.tickets.create
escalated.guest.tickets.store
escalated.guest.tickets.show
escalated.guest.tickets.reply
escalated.guest.tickets.rate

# Inbound Email (no auth)
escalated.inbound.webhook
```

## Ticket Status Machine

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

## Database Tables (14)

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

**Skills (admin routing parity):** `escalated_skills`, `escalated_agent_skills`, `escalated_skill_routing_tags`, `escalated_skill_routing_departments`

## Shared Inertia Data

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

## Events

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
| `escalated:ticket:customActionTriggered` | Agent triggered a custom ticket action |

## Custom Ticket Actions

Host applications can add custom buttons to the agent ticket screen and handle
clicks with a normal event listener. Register actions in `config/escalated.ts`:

```ts
const escalatedConfig: EscalatedConfig = {
  // ...
  ticketActions: {
    actions: [
      {
        key: 'sync-crm',
        label: 'Sync CRM',
        variant: 'primary',                // primary | secondary | danger
        confirmation: 'Sync this ticket to the CRM?',
        metadata: { icon: 'refresh-cw' },
        // visible / enabled may be a boolean or (ticket, user) => boolean
        enabled: (ticket) => !ticket.metadata?.crm_synced,
      },
    ],
  },
}
```

For richer logic, an entry may instead be an object implementing the
`TicketAction` contract (`src/contracts/ticket_action.ts`).

Visible actions are exposed on the agent ticket show page as `customActions`
and on the API ticket detail response as `custom_actions` (each with a `url`
and `method`). Triggering one (`POST /<prefix>/agent/tickets/:ticket/actions/:action`
or the API equivalent) validates the action is visible (404) and enabled (403),
then emits `escalated:ticket:customActionTriggered`:

```ts
import emitter from '@adonisjs/core/services/emitter'
import { ESCALATED_EVENTS } from '@escalated-dev/escalated-adonis'

emitter.on(ESCALATED_EVENTS.TICKET_CUSTOM_ACTION_TRIGGERED, async (data) => {
  if (data.action !== 'sync-crm') return
  // data.ticket, data.user, data.payload, data.metadata
})
```

Escalated also records an internal note on the ticket whenever an action fires,
for auditability.

## Inbound Email

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

## Using Services Directly

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

## Translations (i18n)

Translations are sourced from the central [`@escalated-dev/locale`](https://github.com/escalated-dev/escalated-locale)
npm package and shared with every Escalated host plugin (Laravel, Rails,
Django, Spring, etc.). Three layers are merged at runtime, with later
layers winning on key conflict:

1. **Central package** — `@escalated-dev/locale/locales/{locale}/`
2. **Bundled local** — `resources/lang/{locale}/messages.json` (this package)
3. **Host overrides** — `resources/lang/overrides/{locale}/messages.json`

To override a single string in your host app, create a file under
`resources/lang/overrides/{locale}/messages.json` containing only the keys
you want to change — everything else falls through to the central package.

If your host app uses `@adonisjs/i18n` v3+ directly (in addition to the
plugin's own `t()` helper), see `resources/lang/overrides/README.md` for a
sample `config/i18n.ts` that chains `loaders.fs()` against the central
package and your host's `app.languageFilesPath()`.

## Frontend Package

This package serves only the backend API via Inertia.js. The shared Vue 3 frontend components are provided by the `@escalated-dev/escalated` package, which is framework-agnostic and works with all Escalated backends (AdonisJS, Laravel, Rails, Django).

```bash
npm install @escalated-dev/escalated
```

## Plugin SDK

Escalated supports framework-agnostic plugins built with the [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk). Plugins are written once in TypeScript and work across all Escalated backends.

### Installing Plugins

```bash
npm install @escalated-dev/plugin-slack
npm install @escalated-dev/plugin-jira
```

### Enabling SDK Plugins

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

### How It Works

Unlike other Escalated backends, AdonisJS runs SDK plugins **in-process** — no subprocess, no JSON-RPC overhead. Plugins are loaded directly into the Node.js runtime alongside your AdonisJS application, giving native performance and eliminating the need for a separate plugin runtime process.

### Building Your Own Plugin

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

### Resources

- [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk) — TypeScript SDK for building plugins
- [Plugin Runtime](https://github.com/escalated-dev/escalated-plugin-runtime) — Runtime host for plugins
- [Plugin Development Guide](https://github.com/escalated-dev/escalated-docs) — Full documentation

## Also Available For

- **[Escalated for Laravel](https://github.com/escalated-dev/escalated-laravel)** — Laravel Composer package
- **[Escalated for Rails](https://github.com/escalated-dev/escalated-rails)** — Ruby on Rails engine
- **[Escalated for Django](https://github.com/escalated-dev/escalated-django)** — Django reusable app
- **[Escalated for AdonisJS](https://github.com/escalated-dev/escalated-adonis)** — AdonisJS v7 package (you are here)
- **[Escalated for Filament](https://github.com/escalated-dev/escalated-filament)** — Filament v3 admin panel plugin
- **[Shared Frontend](https://github.com/escalated-dev/escalated)** — Vue 3 + Inertia.js UI components

Same architecture, same Vue UI, same three hosting modes — for every major backend framework.

## Newsletters (optional, disabled by default)

Admin-only broadcast feature for sending Markdown emails to contacts. Off by default — instantiate `NewsletterDispatcher` with `{ enableNewsletters: true }` and run `dispatchBatch()` on a cron.

```ts
import NewsletterDispatcher from '@escalated-dev/escalated-adonis/services/newsletter/newsletter_dispatcher'
import { marked } from 'marked'

const dispatcher = new NewsletterDispatcher({
  enableNewsletters: true,
  batchSize: 50,
  rendererOptions: {
    baseUrl: 'https://support.example.com',
    appName: 'Acme',
    trackingEnabled: true,
    markdownToHtml: (md) => marked.parse(md, { async: false }) as string,
    brand: {
      name: 'Acme',
      accent: '#2563eb',
      physicalAddress: 'Acme Inc. · 123 Main St · Springfield USA',
    },
  },
})

await dispatcher.dispatchBatch()
```

Custom themes go in `resources/views/newsletter_themes/<slug>.edge`. The shipped renderer supports the `{{ key }}` / `{{{ key }}}` substitution subset.

## License

MIT
