# Architecture

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
| `SlaService` | Attach policies, check breaches, calculate due dates with business hours (schedules, time zones, holidays) |
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

The package emits these events on the Adonis emitter (`ESCALATED_EVENTS` from `@escalated-dev/escalated-adonis/events`). Outbound webhooks and workflow triggers use the shared names in the second column (escalated-developer-context ADR 2026-10-21).

| Emitter event | Webhook / workflow name | Description |
|---------------|-------------------------|-------------|
| `escalated:ticket:created` | `ticket.created` | New ticket created |
| `escalated:ticket:updated` | `ticket.updated` | Ticket fields updated |
| `escalated:ticket:statusChanged` | `ticket.status_changed` | Status transition |
| `escalated:ticket:resolved` | `ticket.resolved` | Ticket resolved |
| `escalated:ticket:closed` | `ticket.closed` | Ticket closed |
| `escalated:ticket:reopened` | `ticket.reopened` | Ticket reopened |
| `escalated:ticket:assigned` | `ticket.assigned` | Agent assigned |
| `escalated:ticket:unassigned` | `ticket.unassigned` | Agent unassigned |
| `escalated:ticket:escalated` | `ticket.escalated` | Ticket escalated |
| `escalated:ticket:priorityChanged` | `ticket.priority_changed` | Priority changed |
| `escalated:ticket:departmentChanged` | `ticket.department_changed` | Department changed |
| `escalated:tag:added` | `ticket.tag_added` | Tag added |
| `escalated:tag:removed` | `ticket.tag_removed` | Tag removed |
| `escalated:reply:created` | `reply.created` | Public reply added |
| `escalated:reply:noteAdded` | `note.created` | Internal note added |
| `escalated:sla:warning` | `sla.warning` | SLA target near |
| `escalated:sla:breached` | `sla.breached` | SLA target breached |
| `escalated:chat:started` | `chat.started` | Live chat started |
| `escalated:chat:assigned` | `chat.assigned` | Agent accepted a chat |
| `escalated:chat:transferred` | `chat.transferred` | Chat moved to another agent |
| `escalated:chat:message` | `chat.message` | Chat message sent |
| `escalated:chat:ended` | `chat.ended` | Live chat ended |
| `escalated:ticket:customActionTriggered` | (none) | Agent triggered a custom ticket action |

Webhooks and workflows saved under older names keep working: `ticket.replied`, `internal_note.added`, `internal_note.created`, `tag.added`, `ticket.tagged`, `tag.removed`, `ticket.untagged`, `chat.session_started` and `chat.session_ended` are read as the names above.
