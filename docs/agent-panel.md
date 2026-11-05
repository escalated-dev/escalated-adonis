# Agent panel data

What this package sends the shared frontend's agent panel beyond the ticket
pages' required props. The contract is ADR
[2026-11-05-agent-panel-data](https://github.com/escalated-dev/escalated-developer-context/blob/main/decisions/2026-11-05-agent-panel-data.md)
in escalated-developer-context; escalated-laravel is the reference
implementation. Everything here is optional: an older frontend ignores it.

Run `node ace migration:run` for `0075_create_escalated_agent_panel_data`.

## The agent's own status

| Route | Name | Body | Answer |
|---|---|---|---|
| `PUT` or `POST /{prefix}/agent/status` | `escalated.agent.status` | `{ "status": "online" \| "away" \| "offline" }` | `{ "agent_status": "away" }` (JSON); back (Inertia visit); 422 for any other value |

The status is `agent_profiles.chat_status`, the field chat routing reads. The
existing `escalated.agent.chats.status` route still writes it and now also
answers `agent_status`. Staff share `escalated.agent_status` (`offline` until
set) and `escalated.agent_statuses`. No event is emitted.

## Knowledge-base search

`GET /{prefix}/agent/kb/search?q=` (`escalated.agent.kb.search`, `kb.view`
under roles & permissions): `q` 2 to 200 characters, `limit` 1 to 20 (default
10), otherwise 422. Answers `{ data: [{ id, title, excerpt, url, category, updated_at }] }`
for published articles; `url` is the absolute customer knowledge-base URL.
Case-insensitive `LIKE` on title and body with `%` and `_` literal, title
matches first, then the most recently updated. 404 while the
`knowledge_base_enabled` setting is off (as the customer knowledge base).

## Unread tickets

- `escalated_tickets.last_customer_activity_at` is set when a ticket is
  created (not while importing) and on public replies and chat messages from
  the requester, a guest or contact, or a user who is not staff. Agents'
  replies, notes, and replies with workflow/automation/system metadata never
  move it.
- `escalated_ticket_reads` (`user_id`, `ticket_id`, `last_read_at`); a null
  `last_read_at` means marked unread. Rows go with the ticket.
- Opening `escalated.agent.tickets.show` marks the ticket read.
- `POST /{prefix}/agent/tickets/:ticket/read` and `/unread`
  (`escalated.agent.tickets.read` / `.unread`, `ticket.view`) answer
  `{ is_unread }` or go back; the bulk route takes `mark_read` and
  `mark_unread`.
- `is_unread` on TicketIndex rows and the TicketShow ticket; `inbox.unread`
  (`{ mine, unassigned, all }`). Not in cloud mode.

## Customer online status

`requester_online` and `requester_last_seen_at` on TicketIndex rows and the
TicketShow ticket, from one query per page, never on customer, guest or widget
responses. The customer is the requester, else the ticket's contact, else the
ticket itself. Last-seen (`escalated_customer_presence`) is recorded by the
customer routes (staff skipped), the widget chat (start and every token
request) and the widget ticket lookup, at most once per customer every 30
seconds by a conditional `UPDATE`. Online means within
`presence.onlineWindowSeconds` (env `ESCALATED_PRESENCE_ONLINE_WINDOW`,
default 120).

## Notifications

`escalated_notifications` holds the agents' in-app notifications;
`agentNotifications: false` turns the feed off (routes 404, no shared prop).

| `type` | Sent to | When |
|---|---|---|
| `ticket_assigned` | the assignee | someone else assigns them a ticket |
| `ticket_reply` | the assignee and followers | a customer-side public reply or chat message |
| `sla_warning` / `sla_breached` | the assignee | `escalated:sla:warning` / `escalated:sla:breached` |
| `chat_transferred` | the receiving agent | a chat is transferred to them by someone else |
| `mention` | the mentioned agent | an @mention in another agent's reply or internal note |

@mentions follow escalated-laravel: `@{Full Name}` (what the composer's picker
inserts) and `@name` match an agent or admin (`authorization.isAgent` /
`isAdmin` over the host user model) by name or email, ignoring case, and add
an `escalated_mentions` row. A customer's reply mentions nobody. The picker is
`GET /{prefix}/admin/agents/search?q=` (`escalated.admin.agents.search`,
`ticket.view`): up to 10 `{ id, name, email }`.

| Route | Name | Answer |
|---|---|---|
| `GET /{prefix}/agent/notifications` | `escalated.agent.notifications.index` | `{ data, meta: { current_page, last_page, per_page, total }, unread_count }`; `?page`, `?per_page` (20, max 50), `?unread=1` |
| `POST /{prefix}/agent/notifications/:id/read` | `escalated.agent.notifications.read` | `{ unread_count }`; 404 for someone else's |
| `POST /{prefix}/agent/notifications/read-all` | `escalated.agent.notifications.read-all` | `{ unread_count: 0 }` |

Items are `{ id, type, title, body, ticket, url, created_at, read_at }` with
English titles. A ticket the agent can no longer see is redacted (`ticket`,
`url`, `body` null, generic title). Staff share
`escalated.notifications.unread_count`. Mute preferences are not built.

### Realtime (`notification.created`)

The frontend listens with Laravel Echo, which the host sets up as
`window.Echo`: `Echo.private('escalated.agents.{id}')` and the event
`.notification.created`. AdonisJS has no Echo-compatible server, so with
`broadcasting` on this package sends each new notification, as the feed item
the agent would see (redacted when they can no longer view the ticket), to a
Pusher-protocol server (Pusher, Soketi or Laravel Reverb) or to a transport
you supply. Off by default; without it the frontend refreshes the count on
navigation and when the bell opens.

```ts
// config/escalated.ts
broadcasting: {
  enabled: true,
  // a Pusher-protocol server ...
  pusher: {
    appId: env.get('PUSHER_APP_ID'),
    key: env.get('PUSHER_APP_KEY'),
    secret: env.get('PUSHER_APP_SECRET'),
    host: 'soketi.internal', // or cluster: 'eu' for Pusher
    port: 6001,
    useTLS: false,
  },
  // ... or your own: transport: (channel, event, data) => ...
  // channelPrefix: 'escalated',
},
```

With `pusher`, point Echo's `authEndpoint` at
`POST /{prefix}/agent/broadcasting/auth` (`escalated.broadcasting.auth`,
agents only). It signs `socket_id:channel_name` for the signed-in agent's own
channel, `private-escalated.agents.{id}`, and refuses any other (403); it
answers 404 while `pusher` broadcasting is not configured. A `transport` gets
the channel without Echo's `private-` prefix, the event and the item; deliver
it only to that agent. A failed send is logged and never fails the action that
raised the notification.
