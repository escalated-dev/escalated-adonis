# Getting started

## Requirements

- AdonisJS v7 (Core ^7.0)
- @adonisjs/lucid ^22.0
- @adonisjs/auth ^10.0
- @adonisjs/inertia ^4.0 || ^5.0
- @adonisjs/drive ^4.0 (for file attachments)
- @adonisjs/mail ^10.0
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
2. Register the `EscalatedProvider` and the package's Ace commands in your `.adonisrc.ts`
3. Copy all database migration files to your `database/migrations/` directory

Run the migrations:

```bash
node ace migration:run
```

## Frontend Package

This package serves only the backend API via Inertia.js. The shared Vue 3 frontend components are provided by the `@escalated-dev/escalated` package, which is framework-agnostic and works with all Escalated backends (AdonisJS, Laravel, Rails, Django).

```bash
npm install @escalated-dev/escalated
```

## Embedding the admin in your own admin panel (optional)

Escalated's admin is a standalone panel at `/support/admin` by default, and
needs no setup. If your app already has an admin panel, you can show
Escalated's admin screens inside it instead: under your prefix, your
middleware and your sidebar. It is off unless you turn it on, and changes
nothing until then.

```ts
// config/escalated.ts
import { embedAdmin } from '@escalated-dev/escalated-adonis/support/embed'

ui: {
  enabled: true,
  embed: embedAdmin({ prefix: 'admin/support', middleware: ['auth', 'admin'] }),
},
```

The admin routes then answer under `/admin/support` with the same route
names, and every Inertia page shares the admin menu as `escalated.navigation`
for your sidebar. It works with a Vue + Inertia admin layout, an Edge admin
template as the root view, or an allow-listed iframe (`ESCALATED_EMBED`,
`ESCALATED_EMBED_MODE`, `ESCALATED_EMBED_PREFIX`,
`ESCALATED_EMBED_FRAME_ANCESTORS`). See
[docs/embedding-admin.md](embedding-admin.md).

## Development

Use a current patched release of Node 24 or newer (`.nvmrc` selects Node 24.x).
Install the committed dependency graph with its engine and peer checks enabled:

```bash
npm ci
npm test
npm run lint
npm run format:check
npm audit
```

`npm test` first builds the package, then runs the Node and Japa suites. CI tests
the minimum Node 24 release, Node 25 and Node 26, plus the ticket-access migration
against MySQL and PostgreSQL. See [dependency security](dependency-security.md)
for the rejected Nodemailer major upgrade and the remaining upstream advisories
reported by the full audit.
