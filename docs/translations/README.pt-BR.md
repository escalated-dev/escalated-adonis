<p align="center">
  <a href="README.ar.md">العربية</a> •
  <a href="README.de.md">Deutsch</a> •
  <a href="../../README.md">English</a> •
  <a href="README.es.md">Español</a> •
  <a href="README.fr.md">Français</a> •
  <a href="README.it.md">Italiano</a> •
  <a href="README.ja.md">日本語</a> •
  <a href="README.ko.md">한국어</a> •
  <a href="README.nl.md">Nederlands</a> •
  <a href="README.pl.md">Polski</a> •
  <b>Português (BR)</b> •
  <a href="README.ru.md">Русский</a> •
  <a href="README.tr.md">Türkçe</a> •
  <a href="README.zh-CN.md">简体中文</a>
</p>

# Escalated for AdonisJS

[![Tests](https://github.com/escalated-dev/escalated-adonis/actions/workflows/run-tests.yml/badge.svg)](https://github.com/escalated-dev/escalated-adonis/actions/workflows/run-tests.yml)
[![AdonisJS](https://img.shields.io/badge/adonisjs-v6-5A45FF?logo=adonisjs&logoColor=white)](https://adonisjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Um sistema de tickets de suporte completo e integrável para AdonisJS v6. Adicione-o a qualquer aplicação — obtenha um helpdesk completo com rastreamento de SLA, regras de escalonamento, fluxos de trabalho de agentes e um portal do cliente. Nenhum serviço externo necessário.

> **[escalated.dev](https://escalated.dev)** — Saiba mais, veja demos e compare as opções Cloud vs Auto-hospedado.

## Requisitos

- AdonisJS v6 (Core ^6.0)
- @adonisjs/lucid ^21.0
- @adonisjs/auth ^9.0
- @adonisjs/inertia ^1.0
- @adonisjs/drive ^3.0 (for file attachments)
- @adonisjs/mail ^9.0 (optional, for notifications)
- Node.js 20+

## Instalação

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

## Configuração

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

### Autorização

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

## Funcionalidades

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
- **Ticket Snooze:** Adiar tickets com predefinições (1h, 4h, amanhã, próxima semana); o comando Ace `node ace escalated:wake_snoozed_tickets` os reativa automaticamente
- **Saved Views / Custom Queues:** Save, name, and share filter presets as reusable ticket views
- **Embeddable Support Widget:** Widget leve `<script>` com busca na base de conhecimento, formulário de ticket e verificação de status
- **Email Threading:** Outbound emails include proper `In-Reply-To` and `References` headers for correct threading in mail clients
- **Branded Email Templates:** Configurable logo, primary color, and footer text for all outbound emails
- **Real-time Broadcasting:** Broadcasting opcional via AdonisJS Transmit com fallback automático de polling
- **Knowledge Base Toggle:** Enable or disable the public knowledge base from admin settings

## Arquitetura

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

## Componentes de Página Inertia

All controllers render Inertia pages with the `Escalated/` prefix. Your Vue app must provide these page components:

### Páginas do Cliente
- `Escalated/Customer/Index` - Ticket list
- `Escalated/Customer/Create` - New ticket form
- `Escalated/Customer/Show` - Ticket detail with replies

### Páginas do Agente
- `Escalated/Agent/Dashboard` - Agent dashboard
- `Escalated/Agent/Tickets/Index` - Ticket list with filters
- `Escalated/Agent/Tickets/Show` - Ticket detail with all actions

### Páginas de Administração
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

### Páginas de Visitante
- `Escalated/Guest/Create` - Guest ticket form
- `Escalated/Guest/Show` - Guest ticket view

## Nomes das Rotas

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

## Máquina de Estados do Ticket

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

## Tabelas do Banco de Dados (14)

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

## Dados Compartilhados do Inertia

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

## Eventos

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

## Email de Entrada

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

## Usando Serviços Diretamente

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

## Pacote Frontend

This package serves only the backend API via Inertia.js. The shared Vue 3 frontend components are provided by the `@escalated-dev/escalated` package, which is framework-agnostic and works with all Escalated backends (AdonisJS, Laravel, Rails, Django).

```bash
npm install @escalated-dev/escalated
```

## SDK de Plugins

O Escalated suporta plugins agnósticos de framework construídos com o [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk). Os plugins são escritos uma vez em TypeScript e funcionam em todos os backends do Escalated.

### Instalando Plugins

```bash
npm install @escalated-dev/plugin-slack
npm install @escalated-dev/plugin-jira
```

### Habilitando Plugins SDK

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

### Como Funciona

Unlike other Escalated backends, AdonisJS runs SDK plugins **in-process** — no subprocess, no JSON-RPC overhead. Plugins are loaded directly into the Node.js runtime alongside your AdonisJS application, giving native performance and eliminating the need for a separate plugin runtime process.

### Criando Seu Próprio Plugin

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

### Recursos

- [Plugin SDK](https://github.com/escalated-dev/escalated-plugin-sdk) — SDK TypeScript para criar plugins
- [Plugin Runtime](https://github.com/escalated-dev/escalated-plugin-runtime) — Host de runtime para plugins
- [Plugin Development Guide](https://github.com/escalated-dev/escalated-docs) — Documentação completa

## Também Disponível Para

- **[Escalated for Laravel](https://github.com/escalated-dev/escalated-laravel)** — Pacote Laravel Composer
- **[Escalated for Rails](https://github.com/escalated-dev/escalated-rails)** — Motor Ruby on Rails
- **[Escalated for Django](https://github.com/escalated-dev/escalated-django)** — Aplicativo Django reutilizável
- **[Escalated for AdonisJS](https://github.com/escalated-dev/escalated-adonis)** — Pacote AdonisJS v6 (você está aqui)
- **[Escalated for Filament](https://github.com/escalated-dev/escalated-filament)** — Plugin de painel administrativo Filament v3
- **[Shared Frontend](https://github.com/escalated-dev/escalated)** — Componentes de UI Vue 3 + Inertia.js

Mesma arquitetura, mesma interface Vue, mesmos três modos de hospedagem — para cada framework backend importante.

## Licença

MIT
