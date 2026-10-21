# Verified guest access

Guest ticket creation, widget live chat and ticket lookup need proof that the
guest can read the mailbox they give: an eight-digit code emailed to it. Guests
then open their ticket with an expiring grant instead of a permanent link. This
ports escalated-laravel's verified guest access (`docs/guest-access.md` there)
and follows the same contract, so the shared frontend's flows work unchanged.

## Upgrade

Run the package migrations (`0065_verified_guest_access`: a
`escalated_guest_verifications` table and four nullable ticket columns).

Codes are sent with `@adonisjs/mail`, so configure a mailer. To send them some
other way, set `guestAccess.sendCode: async (email, code, purpose) => { ... }`
in `config/escalated.ts`.

Deploy a shared frontend (`@escalated-dev/escalated`) whose guest form and
widget have the email-code step. Older clients cannot create guest tickets or
start widget chats any more.

**Existing guest links.** The permanent 64-character guest tokens no longer
open anything (as in Laravel). Tickets are untouched; a guest renews access with
a lookup (below), which issues a grant and clears the old token. To keep old
links working during a transition, set `guestAccess.legacyTokens: true`; turn
it off once guests have moved over.

## Email codes

`POST verification` on the browser (`{prefix}/guest`) and widget
(`{prefix}/widget`) surfaces:

```json
{ "email": "recipient@example.com", "purpose": "ticket" }
```

`purpose` is `ticket`, `chat` or `lookup`. The answer is
`202 { verification_id, expires_in: 600, message }`; only the email holds the
code. `ticket` and `lookup` need guest tickets switched on; the widget surface
needs the widget switched on.

Send `verification_id` and `verification_code` with the operation the code is
for. A code:

- is bound to the normalised email address and the purpose;
- expires after ten minutes;
- allows five guesses, counted whether right or wrong;
- is spent once. If the operation it authorises fails, it is released so the
  guest can retry with the same code.

Neither the code nor the address is stored in the clear: both are keyed digests
(the application's encryption key). Codes that expired a day ago are deleted as
new ones are made.

Budgets, on top of the per-IP guest rate limit: 3 codes per mailbox per client
IP per hour, and 10 per mailbox per hour across all IPs, so one client cannot
lock the owner out. Over budget answers 429 with `Retry-After`. Tune them with
`guestAccess.challengesPerClientPerHour` and
`guestAccess.challengesPerMailboxPerHour`; they are counted in
`guestAccess.store`, else `guestRateLimit.store`, else in memory per process.

## Tickets and grants

- **Browser** `POST {prefix}/guest`: the existing form (`guest_name`,
  `guest_email`, ...; `name`/`email` are also accepted) plus the proof fields.
  It redirects to `{prefix}/guest/<grant>`. `Guest/Create` receives
  `verification_url` and `lookup_url`.
- **Widget** `POST {prefix}/widget/tickets`: the existing body plus the proof
  fields. 201 `{ message, reference, ticket_reference, guest_access_token,
  expires_at }`.

A grant is an opaque, encrypted, expiring token. Do not parse it. It lasts
`guestAccess.ttlMinutes` (default 1440, clamped to 5 minutes through 7 days).
The ticket stores only the SHA-256 of the grant's random nonce. Issuing a new
grant rotates the nonce, which revokes the earlier grant and the attachment
links issued under it. Changing the ticket's guest email revokes its proof and
grants. Host code can call `revoke(ticket)` from `support/guest_access`.

The grant opens `GET {prefix}/guest/<grant>`, its reply and rating routes, and
`GET {prefix}/widget/tickets/<reference>` with `Authorization: Bearer <grant>`
(the grant must name that reference; an email query parameter authorises
nothing). That answer has `reference`, `subject`, `status`, `status_label`,
`status_color`, `created_at`, `department` and the 20 latest public `replies`.

Guest answers carry `Cache-Control: no-store, private` and
`Referrer-Policy: no-referrer`. The guest page leaves out ticket and reply
metadata, chat metadata and the requester record. Redact guest grant route
segments and `Authorization` headers from access logs.

## Lookup and renewal

Request a `lookup` code, then `POST lookup` on either surface:

```json
{ "email": "...", "reference": "ESC-00042", "verification_id": "...", "verification_code": "..." }
```

The answer is `{ data: [{ reference, subject, guest_access_token, expires_at }] }`
for at most 20 tickets with that reference and guest email. A reference alone
unlocks nothing; the list may be empty, and the code is spent either way.

## Live chat

`POST {prefix}/widget/chat/start` needs a `chat` code for the visitor's email.
The chat paths still use the chat's random visitor token (`id`); chat grants do
not expire in this package.

## Not in this package

- Mobile guest routes: this package has none.
- Lookup matches the Escalated reference only (no host `external_reference`).
- Consumption and the operation are not one database transaction: the code is
  claimed with a conditional update first and released if the operation fails.
- A `chat_enabled` switch: `chat` codes are issued whenever the widget is on.
