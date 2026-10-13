# Ticket access and routing

These additions are opt-in. The defaults are `visibility: 'all'`, `accounts.enabled: false`, `accounts.scopeAgents: false`, and `targetedSlas: false`. Run migration 0064 on the configured package connection; existing tickets and SLA policies retain nullable account/target fields.

## Department visibility

Set `visibility: 'department'`. The existing `authorization.isAgent` and `authorization.isAdmin` callbacks remain authoritative. Agents see tickets in their `escalated_department_agent` departments; tickets without a department are hidden. Assignment and following do not grant access. Admins retain full access. Customers and guests retain the existing ownership/token checks.

The provider installs a Lucid query scope and every package ticket route establishes the actor after authentication, including bearer-token, guest and widget routes. The scope covers ticket models, Lucid database queries used by reports, search, pagination counts, bulk changes, and related records. Loaded-model service operations also check access. SQL conditions are grouped so an OR expression cannot bypass the restriction.

Host routes and jobs acting for a person must use `withTicketAccess(user, async () => ...)` from the package root. Keep queries and serialization inside the callback. Background work without an actor retains full access. `withoutTicketAccess(async () => ...)` explicitly bypasses visibility for trusted internal work only. Direct Knex builders and raw SQL strings are trusted interfaces and do not receive Lucid scopes. Never expose those bypasses to request input.

## Ticket accounts

Tickets have indexed nullable `account_type` / `account_id` columns. Escalated owns no company table. Configure `accounts.enabled: true` and `accounts.resolver(reference)`, returning `{ type: 'Company', id: '123' }` or null. References contain `kind` (`requester`, `subject`, or `agent`), `type`, `id`, and an optional resolved `model`.

The requester populates a new ticket's account. Attaching a subject fills an empty account; it does not replace an existing one. Splits preserve the original account. Request bodies cannot select an arbitrary account. Ticket/API lists accept both `account_type` and `account_id`; incomplete pairs match nothing. Account identity comparison is case sensitive, including on MySQL.

Set `accounts.scopeAgents: true` to intersect account and department visibility. Each agent resolver returns one account; a missing account matches no tickets. Admins bypass both restrictions. Invalid account visibility configuration fails at startup. Host user lookup uses `userModel`, so the host user database need not share a connection with package tables.

## Rules and SLA targets

Escalation rules, automations and workflows accept `ticket_type` and `account` conditions. An account value is the complete `{ type, id }` pair; equality and inequality are supported. Workflows also support `is_empty` and `is_not_empty`. Invalid identities and unsupported account operators never match. Department conditions remain available.

Set `targetedSlas: true` (and `sla.enabled: true`) to select active SLA policies by their nullable `departmentId` and `ticketType` targets. Precedence is both targets, department, type, then the untargeted default; lowest id breaks ties. Targeted policies are ignored when the feature is off. Deadlines are calculated from ticket creation. Changing a department/type preserves the existing policy and clock. Call `SlaService.attachDefaultPolicy(ticket)` explicitly to reselect a policy; it does not restart the clock.

## Recipients and real-time transports

Assignment and chat services reject agents who cannot access the ticket; auto-assignment and follower notification ids are filtered too. The agents API accepts `ticket_id` to return eligible candidates. Hosts must recheck queued notification recipients at delivery with `agentCanAccessTicket` or `userCanAccessTicket`.

The generic broadcast transport cannot enumerate subscribers or revoke a stale subscription. Restricted mode therefore suppresses payloads through that transport. Supply `BroadcastConfig.deliverAuthorized(payload, canReceive)` to deliver scoped events, calling `await canReceive(userId)` for every recipient immediately before sending. It resolves current host roles, account and department membership. Unrestricted shared channel authorization is denied for restricted agents. With restrictions disabled, the existing transport behavior is unchanged.
