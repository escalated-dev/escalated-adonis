# Embedding the admin in your own admin panel (optional)

Escalated ships a complete standalone admin at `/support/admin` (your
`routes.prefix` + `/admin`), with its own sidebar and top bar. **That is the
default, and it needs no setup.** If your AdonisJS app already has an admin
panel, you can instead show Escalated's admin screens inside it: under your
sidebar and header, your URL prefix and your middleware.

This is an optional alternative to the standalone admin. Nothing on this page
has any effect until you turn it on: with no embed configuration every route,
page, prop, header and gate is exactly what it was before. The design is in
the ADR
[`2026-11-05-embeddable-admin`](https://github.com/escalated-dev/escalated-developer-context/blob/main/decisions/2026-11-05-embeddable-admin.md);
the frontend side is documented in
[`@escalated-dev/escalated` docs/embedding-admin.md](https://github.com/escalated-dev/escalated/blob/main/docs/embedding-admin.md).

## Contents

- [Pick your setup](#pick-your-setup)
- [Turning it on](#turning-it-on)
- [Configuration reference](#configuration-reference)
- [What changes, and what does not](#what-changes-and-what-does-not)
- [1. Vue + Inertia host](#1-vue--inertia-host)
- [2. Edge host](#2-edge-host)
- [3. iframe](#3-iframe)
- [The admin menu: `escalated.navigation`](#the-admin-menu-escalatednavigation)
- [Security](#security)
- [Turning it off](#turning-it-off)

## Pick your setup

| Your admin panel | Use | `mode` |
|---|---|---|
| Inertia + Vue in this app | [Vue + Inertia host](#1-vue--inertia-host) | `layout` |
| Edge templates | [Edge host](#2-edge-host) (your Edge admin template as the root view) | `layout` |
| Another app or origin, a non-Vue SPA, a CMS admin | [iframe](#3-iframe) | `iframe` |

## Turning it on

Set `ui.embed` in `config/escalated.ts`. `embedAdmin()` fills in the defaults
and turns it on:

```ts
// config/escalated.ts
import { embedAdmin } from '@escalated-dev/escalated-adonis/support/embed'

const escalatedConfig: EscalatedConfig = {
  // ...
  ui: {
    enabled: true,
    embed: embedAdmin({
      prefix: 'admin/support',
      // Named as in router.named() in start/kernel.ts: your sign-in and your
      // own admin check.
      middleware: ['auth', 'admin'],
      layout: 'Layouts/AdminLayout',
    }),
  },
}
```

or write the keys yourself (the config file published by
`node ace configure` has this block, reading the environment):

```ts
ui: {
  enabled: true,
  embed: {
    enabled: process.env.ESCALATED_EMBED === 'true',
    mode: process.env.ESCALATED_EMBED_MODE === 'iframe' ? 'iframe' : 'layout',
    prefix: process.env.ESCALATED_EMBED_PREFIX || 'admin/support',
    middleware: null,
    replaceAdminGate: false,
    layout: null,
    rootView: null,
    frameAncestors: process.env.ESCALATED_EMBED_FRAME_ANCESTORS ?? '',
  },
},
```

A config file that predates this feature has no `embed` block. Then the
environment variables alone decide, and with none set it stays off. The
routes are registered when the app boots, so restart it after a change.

## Configuration reference

| Key (`ui.embed.*`) | Env var | Default | Meaning |
|---|---|---|---|
| `enabled` | `ESCALATED_EMBED` (`true`) | `false` | Master switch. While `false`, nothing below has any effect. Needs `ui.enabled`. |
| `mode` | `ESCALATED_EMBED_MODE` | `'layout'` | `'layout'` (Vue + Inertia or Edge host) or `'iframe'`. |
| `prefix` | `ESCALATED_EMBED_PREFIX` | `'admin/support'` | URL prefix the admin moves under. |
| `middleware` | | `null` | Middleware for the admin routes, named as in `router.named()` in `start/kernel.ts` (or middleware references). `null` keeps `routes.adminMiddleware` (`['auth']`). A name your kernel does not define stops the app from booting. |
| `replaceAdminGate` | | `false` | `true` removes Escalated's admin gate from these routes so your middleware alone decides. Refused without `middleware`. See [Security](#security). |
| `layout` | | `null` | Name of your Vue admin layout, matched against the frontend plugin's `layouts` option. |
| `rootView` | | `null` | Edge root view for embedded pages ([Edge host](#2-edge-host)); a template name or `(ctx) => name`, as `rootView` in `config/inertia.ts`. |
| `frameAncestors` | `ESCALATED_EMBED_FRAME_ANCESTORS` (comma-separated) | `[]` | iframe mode: exact origins allowed to frame the admin, as a list or a comma-separated string. Wildcards, `*`, paths and other schemes are ignored. |

`embedAdmin()` takes the same keys except `enabled`, and throws on an unknown
`mode` or on `replaceAdminGate` without `middleware`.

## What changes, and what does not

While embedding is on:

- Every `escalated.admin.*` route that lived under `/support/admin` (the admin
  screens, Plugins, API tokens, Import), and the SDK plugins' admin pages
  (`/support/admin/plugins/{plugin}/...`), are registered under your `prefix`
  with your `middleware`, followed by Escalated's own guards (`ensureIsAdmin`
  unless you replace it, `requireTwoFactor`, `enforceRoutePermissions`).
  **Route names and controllers do not change**, so the `route()` helper the
  shared frontend calls (`window.route`) follows the move as long as it builds
  URLs from your router's named routes. The old `/support/admin/...` URLs
  answer 404.
- Embedded pages carry `escalated.embed` (below) and every Inertia page,
  yours included, carries `escalated.navigation`, the admin menu for your
  sidebar.

Unchanged: the agent panel (`/support/agent`, including End Chat at
`/support/admin/chat/:session/end`, an agent action), customer portal, guest
pages, widget, API, SSO, plugin data endpoints and webhooks, the two-factor
enrolment page (`/support/admin/settings/two-factor`, for every staff user)
and challenge, and the newsletter admin (`/support/admin/newsletters`).

`escalated.embed` on an embedded page:

```json
{
  "enabled": true,
  "mode": "layout",
  "layout": "Layouts/AdminLayout",
  "route": "escalated.admin.tickets.index",
  "base_url": "/admin/support",
  "allowed_origins": []
}
```

On every other page `enabled` is `false` and `route` is `null`.

Escalated shares the `escalated` prop itself while embedding is on, through a
router middleware, using the request's Inertia instance. Your Inertia
middleware (`#middleware/inertia_middleware`, which the AdonisJS starter kits
register in `start/kernel.ts`) creates that instance; nothing else is needed.

## 1. Vue + Inertia host

Backend: turn embedding on (above) with your prefix and admin middleware.

Frontend (`inertia/app.ts`): register your admin layout under the name you
gave `layout`, or add `admin` to the plugin's `layoutScope`:

```ts
import { createInertiaApp } from '@inertiajs/vue3'
import { createApp, h } from 'vue'
import { EscalatedPlugin } from '@escalated-dev/escalated'
import AdminLayout from '~/layouts/AdminLayout.vue'
import AppLayout from '~/layouts/AppLayout.vue'

createInertiaApp({
  // resolve: ... as you have it
  setup({ el, App, props, plugin }) {
    createApp({ render: () => h(App, props) })
      .use(plugin)
      .use(EscalatedPlugin, {
        layout: AppLayout, // customer pages, as before
        layouts: { 'Layouts/AdminLayout': AdminLayout }, // embedded admin pages
        theme: { panel: { mode: 'light' } }, // match your admin
      })
      .mount(el)
  },
})
```

Your admin layout needs the same slots the plugin's `layout` always required, a
`#header` slot (Escalated puts the page title there) and a default slot. List
Escalated's menu with `<EscalatedNavigation />`:

```vue
<!-- inertia/layouts/AdminLayout.vue -->
<script setup lang="ts">
import { Link } from '@inertiajs/vue3'
import { EscalatedNavigation } from '@escalated-dev/escalated'
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="w-64 border-r bg-white p-3">
      <Link href="/admin">Dashboard</Link>
      <!-- ...your own items... -->
      <p class="mt-4 px-3 text-xs font-semibold uppercase text-gray-500">Support</p>
      <EscalatedNavigation />
    </aside>
    <div class="flex-1">
      <header class="border-b bg-white px-6 py-4"><slot name="header" /></header>
      <main class="p-6"><slot /></main>
    </div>
  </div>
</template>
```

Escalated renders each admin page chrome-free (no Escalated sidebar, top bar,
logo or footer) inside your layout. To use the same layout for customer pages
too, use `layout: AdminLayout, layoutScope: ['customer', 'admin']` instead of
`layouts`.

## 2. Edge host

If your admin layout is an Edge template, make a root view that contains your
chrome and the Inertia mount point, and point `rootView` at it:

```ts
// config/escalated.ts
ui: {
  enabled: true,
  embed: embedAdmin({
    prefix: 'admin/support',
    middleware: ['auth', 'admin'],
    rootView: 'admin/escalated',
  }),
},
```

```edge
{{-- resources/views/admin/escalated.edge --}}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin</title>
  {{-- Your assets, as in resources/views/inertia_layout.edge, e.g. @vite(['inertia/app.ts']) --}}
  @inertiaHead()
</head>
<body data-root-view="admin/escalated">
  <header class="admin-header">Acme admin</header>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <a href="/admin">Dashboard</a>
      <p class="menu-heading">Support</p>
      <ul>
        @each(item in escalatedNavigation)
          <li>
            <a href="{{ item.url }}"{{{ item.active ? ' class="active" aria-current="page"' : '' }}}>{{ item.label }}</a>
          </li>
        @end
      </ul>
    </aside>
    <main class="admin-main">
      @inertia()
    </main>
  </div>
</body>
</html>
```

`escalatedNavigation` is the admin menu (`adminNavigation()`, below), which
Escalated gives this template on each embedded page load. Only embedded pages
use this root view; every other page keeps your `config/inertia.ts`
`rootView`. Your Inertia entry needs no extra option: Escalated sees
`escalated.embed.enabled` and renders the page chrome-free (title + content).

To list the menu in another template or a controller of your own, call
`adminNavigation(user, ctx)` from `@escalated-dev/escalated-adonis`.

## 3. iframe

For an admin that is not part of this app (another origin, another stack),
frame the embedded admin:

```ts
ui: {
  enabled: true,
  embed: embedAdmin({
    prefix: 'admin/support',
    middleware: ['auth', 'admin'],
    mode: 'iframe',
    frameAncestors: ['https://admin.example.com'],
  }),
},
```

or `ESCALATED_EMBED=true`, `ESCALATED_EMBED_MODE=iframe`,
`ESCALATED_EMBED_FRAME_ANCESTORS=https://admin.example.com` with the published
config.

Embedded responses then carry
`Content-Security-Policy: frame-ancestors 'self' https://admin.example.com`
and no `X-Frame-Options`: the allow-listed `frame-ancestors` replaces it on
those responses only, when their headers are written, so `@adonisjs/shield`'s
`xFrame` guard and your other middleware cannot undo it. If your app already
sends a CSP, it is kept and this directive is added as a second policy; if
your own policy has a `frame-ancestors` directive, add the same origins there
too, since browsers enforce both.

On the framing page:

```html
<iframe id="support-admin" src="https://support.example.com/admin/support/tickets"
        style="width:100%;border:0" title="Support administration"></iframe>
<script type="module">
  import { connectEscalatedFrame } from '@escalated-dev/escalated/embed'

  const frame = connectEscalatedFrame(document.getElementById('support-admin'), {
    origin: 'https://support.example.com',
    onNavigate: ({ route, title }) => highlightMenu(route),
  })
  frame.setTheme('light')
</script>
```

The frame sizes itself to its content and reports each page change; the
protocol is in the frontend guide.

### Session cookies in a frame

- **Same site** (`admin.example.com` framing `support.example.com`): the
  default `sameSite: 'lax'` session cookie works.
- **Cross-site** (different registrable domains): the session cookie must be
  sent in a third-party context. In `config/session.ts` set
  `cookie: { sameSite: 'none', secure: true, httpOnly: true }`, and serve both
  sites over HTTPS. Browsers that block third-party cookies will still not keep
  a session in a cross-site frame; use the Vue + Inertia or Edge setup in that
  case.
- CSRF protection (`@adonisjs/shield`) is unchanged.

## The admin menu: `escalated.navigation`

While embedding is on, every Inertia page shares the admin menu, and
`adminNavigation(user?, ctx?)` returns the same list (it works whether or not
embedding is on):

```json
[
  {
    "key": "tickets",
    "label": "Tickets",
    "route": "escalated.admin.tickets.index",
    "url": "/admin/support/tickets",
    "icon": "tickets",
    "position": 20,
    "active": true,
    "badge": null,
    "plugin": null,
    "children": []
  }
]
```

It is filtered for the user: empty for anyone who fails Escalated's admin gate
(unless you replaced it), screens whose feature is off are left out (Roles
while roles & permissions is off, Plugins while plugins are off, Newsletters
while they are off), and while roles & permissions is on each item needs the
permission its route requires. Plugin admin menu items are included, sorted by
`position` with the core items. Core `icon` keys match the frontend's
`escalatedNavIcons`. The audit log item's route is
`escalated.admin.audit-logs.index`, this package's name for that screen.

## Security

- **The admin gate stays on by default.** Your middleware runs *in addition to*
  Escalated's admin check (`authorization.isAdmin`). Set `replaceAdminGate`
  only if your middleware itself restricts the routes to admins: with it on,
  your middleware is the only check on who reaches the admin. Two-factor and
  route permissions still apply either way, and the agent panel and
  `escalated.is_admin` keep Escalated's own checks.
- **Framing is allow-listed.** In iframe mode only the origins you list (plus
  your own) may frame the admin; nothing else, and never `*`. No other
  response's headers change.
- **No open `postMessage`.** The frame talks only to an allow-listed parent
  origin and ignores messages from anywhere else.

## Turning it off

Remove the `embed` block (or `embedAdmin()` call) or set
`ESCALATED_EMBED=false`, then restart the app. The admin returns to
`/support/admin` with Escalated's own chrome.
