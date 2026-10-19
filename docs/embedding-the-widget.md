# Embedding the widget on other sites

The support widget, ticket form and live chat can run on a site other than
the one Escalated is installed on: a store, a marketing site or a customer
portal loads one script from your Escalated install. Nothing changes until you
list the sites that may do this.

## 1. Allow the embedding sites

Either in `config/escalated.ts`:

```ts
widget: {
  allowedOrigins: process.env.ESCALATED_WIDGET_ALLOWED_ORIGINS ?? '',
  preflightMaxAge: 600,
  serveScript: true,
},
```

```dotenv
ESCALATED_WIDGET_ALLOWED_ORIGINS=https://shop.example.com,https://*.example.org
```

or in the admin settings (`POST {prefix}/admin/settings` with
`widget_allowed_origins`, one origin per line or comma separated). Both lists
are combined. Each entry is an origin: `scheme://host[:port]`, http or https,
no path, query or user name. `https://*.example.org` matches every subdomain of
`example.org` but not `example.org` itself. A bare `*` is rejected, and the
settings form refuses any entry that is not a valid origin.

`allowedOrigins` takes an array or a comma separated string.

## 2. Let allowed sites skip shield's CSRF check

The package adds no CSRF check of its own. If the host uses `@adonisjs/shield`
with CSRF enabled, its middleware runs before any route middleware and would
refuse widget POSTs from another site, which have no token to send. Exempt
exactly those requests in `config/shield.ts`:

```ts
import { isWidgetCsrfExempt } from '@escalated-dev/escalated-adonis'

csrf: {
  enabled: true,
  exceptRoutes: (ctx) => isWidgetCsrfExempt(ctx),
  // ...
},
```

If you already list routes, combine them:

```ts
exceptRoutes: (ctx) => isWidgetCsrfExempt(ctx) || ['/webhooks/stripe'].includes(ctx.route?.pattern ?? ''),
```

`isWidgetCsrfExempt` returns true only for an Escalated widget route whose
`Origin` is another site on the allow list. Same-origin requests, requests
without an `Origin`, requests from unlisted sites and every non-widget route
keep the CSRF check exactly as before.

shield calls `exceptRoutes` synchronously, so it checks the config list plus
the admin setting as last read by this process (each widget request reads it,
and a browser sends its preflight before the POST). A request the check let
through on a stale copy is refused with 403 by the widget middleware once the
setting has been re-read. With several processes, listing origins in the
config is the most predictable.

## 3. Add the script to the other site

```html
<script src="https://help.example.com/support/widget/embed.js" async></script>
```

For an on-page support form instead of a floating button:

```html
<div id="support-form"></div>
<script
  src="https://help.example.com/support/widget/embed.js"
  data-mode="inline"
  data-target="#support-form"
  data-tabs="ticket"
  data-meta-order-number="A-1001"
></script>
```

All host parameters (tabs, department, prefill, metadata, title, the
JavaScript API) are described in the frontend package's
[embedding guide](https://github.com/escalated-dev/escalated/blob/main/docs/embedding-the-widget.md).

## What the server does

For a request whose `Origin` is on the list, the widget routes
(`{prefix}/widget/*`, including `{prefix}/widget/chat/*`):

- answer preflight requests (`OPTIONS` with `Access-Control-Request-Method`)
  with 204, `Access-Control-Allow-Origin: <origin>`, methods
  `GET, POST, OPTIONS`, headers
  `Accept, Authorization, Content-Type, X-Requested-With` and
  `Access-Control-Max-Age` (`widget.preflightMaxAge`, 600 by default);
- add `Access-Control-Allow-Origin`, `Access-Control-Expose-Headers:
Retry-After` and `Vary: Origin` to every response, including 400, 404 and
  the rate limiters' 429. The CORS middleware runs first in the widget route
  groups, before the rate limiters;
- treat the visitor as a guest even if the same browser is signed in to the
  host: `ctx.auth` is replaced with a guest for that request, so a signed-in
  agent's session is never used from another site.

`Access-Control-Allow-Credentials` is never sent. Requests from any other
origin, and same-origin requests, are handled exactly as before; a preflight
from an unlisted site gets a 204 with no CORS grant. The `widget_enabled`
setting and the guest rate limits apply to embedded requests unchanged.

The grant is added by route middleware, so a global (server or router)
middleware that answers first, such as a host-wide throttle, does not carry
it. If the host uses `@adonisjs/cors`, keep `{prefix}/widget` out of its
scope, or its global middleware answers the widget's preflights with its own
settings.

### Host parameters

`/config` returns `accepts_metadata: true` (its other keys are unchanged).
Widget tickets (`POST {prefix}/widget/tickets`) store the `metadata` object
the page sends in the ticket's `metadata`, next to `source: 'widget'`, which
the page cannot override. Live chats (`POST {prefix}/widget/chat/start`) store
it in the ticket's `chat_metadata` and on the chat session.

The values come from the visitor's browser, so only a flat map is kept: up to
25 entries, keys of letters, digits, `_ . : -` (64 characters at most), and
string, number or boolean values (strings trimmed and cut to 500 characters).
`page_url` is kept only when it is an http(s) URL. `embedded_on` is always set
by the server from the request's `Origin` and cannot be supplied by the page.
A `metadata` that is not an object, or has more than 50 keys, is answered with
400. Treat all of it as unverified visitor input.

### The script

`GET {prefix}/widget/embed.js` serves the bundle vendored in
`resources/widget/escalated-widget.js` (from `@escalated-dev/escalated`
`dist/widget`), with `Cache-Control: public, max-age=3600`, an `ETag` (304 on
a matching `If-None-Match`), `Cross-Origin-Resource-Policy: cross-origin` and
`Access-Control-Allow-Origin: *`. Set `widget.serveScript` to `false` to
unmount the route, for example when you serve the bundle from a CDN; pages
then need `data-base-url`.

## Troubleshooting

- **The browser reports a CORS error.** The page's origin is not on the list,
  or it differs in scheme or port (`http://` vs `https://`, `:8080`).
- **POSTs return 403 with a CSRF error.** shield's `csrf.exceptRoutes` does not
  call `isWidgetCsrfExempt`, or the origin is not on the list.
- **Behind a proxy the site is treated as same-origin or as another site.**
  The request's own origin comes from `request.protocol()` and
  `request.host()`; set `http.trustProxy` in `config/app.ts` so they reflect
  the public address.
