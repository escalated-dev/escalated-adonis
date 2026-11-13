# Features

## Features

- **Tickets:** Create, view, update, close, reopen tickets with status machine
- **Replies:** Threaded conversations with rich text and pinned notes
- **Departments:** Organize tickets by team with agent assignments
- **Tags:** Label and categorize tickets
- **SLA Policies:** First response and resolution time tracking with breach detection; run the `node ace escalated:check-sla` Ace command on a schedule (e.g. every minute) so breaches are flagged and `escalated:sla:breached` / `escalated:sla:warning` are emitted
- **Escalation Rules:** Automated ticket escalation based on configurable conditions; run the `node ace escalated:run-escalations` Ace command on a schedule (e.g. every 5 minutes) so rules fire periodically
- **Canned Responses:** Pre-written reply templates (shared or per-agent)
- **Activity Log:** Full audit trail of all ticket changes
- **Verified guest access:** Emailed codes for guest tickets, widget chats and lookups; guests open tickets with expiring grants (see [docs/guest-access.md](guest-access.md))
- **Merge, links and side conversations:** Merge duplicate tickets, link related tickets and hold side conversations from the admin ticket page
- **Attachments:** Private file uploads, served only through an access-checked, expiring download link (see [docs/private-attachments.md](private-attachments.md))
- **Notifications:** Webhook-based notifications with HMAC signing
- **Outbound Webhooks:** Signed deliveries with a delivery log and retries. Webhook URLs that resolve to loopback, private-network, link-local or other non-public addresses are refused when saved and before every delivery, as are the workflow `send_webhook` action's; set `webhooks.allowPrivateUrls` to allow them
- **Admin Settings:** Runtime-configurable settings stored in the database
- **Guest Tickets:** Anonymous ticket creation with 64-character token access. Guest ticket creation (form and widget) and guest replies are rate-limited per client IP (5 and 10 a minute by default, `guestRateLimit` in the config); behind a proxy, set `http.trustProxy` so each guest gets their own IP
- **Inbound Email:** Mailgun, Postmark, and SES adapters with auto-threading and attachment processing
- **Three Role Types:** Customer, Agent, Admin with separate dashboards
- **Bulk Actions:** Batch status/priority/assignment/tag/department changes
- **Macros:** Multi-step automated actions (status + priority + reply in one click)
- **Followers:** Subscribe to ticket updates
- **CSAT Ratings:** Post-resolution satisfaction surveys (1-5 scale)
- **Quick Filters:** Pre-built filter shortcuts (My Tickets, Unassigned, Breached SLA, etc.)
- **Presence Indicators:** See who is viewing a ticket in real time
- **SSO:** SAML, OAuth 2 / OIDC and JWT sign-in at `{prefix}/sso/login` behind the `ESCALATED_SSO` switch (off by default); see [docs/access-control.md](access-control.md#single-sign-on) and [docs/sso.md](sso.md)
- **RBAC:** Role-based access control with granular permissions, enforced on every admin, agent and staff API route when `access.rolesPermissions` (`ESCALATED_ROLES_PERMISSIONS`) is on; off by default (see [docs/access-control.md](access-control.md))
- **Automation:** Configurable automation rules with conditions and actions; run the `node ace escalated:run-automations` Ace command on a schedule to apply them periodically
- **i18n:** Multi-language support sourced from the central `@escalated-dev/locale` npm package, with optional per-host overrides under `resources/lang/overrides/`
- **Plugin System:** Extensible via TypeScript SDK plugins
- **REST API:** Token-authenticated API with rate limiting. Admins issue tokens with the `agent` and/or `admin` abilities: agent endpoints need `agent` and a token owner who is still an agent or admin, and deleting a ticket needs `admin` and an owner who is an admin
- **Import Framework:** Bulk data import support
- **Ticket Splitting:** Split a reply into a new standalone ticket while preserving the original context
- **Ticket Snooze:** Snooze tickets with presets (1h, 4h, tomorrow, next week); `node ace escalated:wake-snoozed-tickets` Ace command auto-wakes them on schedule
- **Saved Views / Custom Queues:** Save, name, and share filter presets as reusable ticket views
- **Embeddable Support Widget:** Lightweight `<script>` widget with KB search, ticket form, and status check, served at `{prefix}/widget/embed.js` and embeddable on the sites you list; see [embedding the widget](embedding-the-widget.md)
- **Email Threading:** Outbound emails include proper `In-Reply-To` and `References` headers for correct threading in mail clients
- **Branded Email Templates:** Configurable logo, primary color, and footer text for all outbound emails
- **Real-time Broadcasting:** Opt-in broadcasting via AdonisJS Transmit with automatic polling fallback
- **Knowledge Base Toggle:** Enable or disable the public knowledge base from admin settings

## Ticket access and routing

See [ticket access and routing](ticket-access-and-routing.md) for optional department/account visibility, account routing and targeted SLAs.
