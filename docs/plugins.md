# Building Plugins

Plugins extend Escalated with custom functionality using a WordPress-style hook system. Plugins can be distributed as ZIP files (uploaded via the admin panel) or as npm packages.

## Plugin Structure

A minimal plugin needs two files:

```
my-plugin/
  plugin.json      # Manifest (required)
  plugin.ts        # Entry point (required)
```

### plugin.json

```json
{
    "name": "My Plugin",
    "slug": "my-plugin",
    "description": "A short description of what this plugin does.",
    "version": "1.0.0",
    "author": "Your Name",
    "author_url": "https://example.com",
    "requires": "1.0.0",
    "main_file": "plugin.ts"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Human-readable plugin name |
| `slug` | Yes | Unique identifier (lowercase, hyphens only) |
| `description` | No | Short description shown in the admin panel |
| `version` | Yes | Semver version string |
| `author` | No | Author name |
| `author_url` | No | Author website URL |
| `requires` | No | Minimum Escalated version required |
| `main_file` | No | Entry point filename (defaults to `plugin.ts`) |

### plugin.ts

The main file is loaded when the plugin is activated. Use it to register hooks:

```typescript
import { escalated_addAction, escalated_addFilter } from '@escalated-dev/escalated-adonis/support/helpers'

// Runs every time a ticket is created
escalated_addAction('ticket_created', async (ticket) => {
  // Send a Slack notification, create a Jira issue, etc.
  console.log(`New ticket: ${ticket.reference}`)
})

// Modify ticket data before it's saved
escalated_addFilter('ticket_data', async (data) => {
  data.custom_field = 'value'
  return data
})
```

## Distribution Methods

### ZIP Upload (Local Plugins)

1. Create a ZIP file containing your plugin folder at the root:
   ```
   my-plugin.zip
     └── my-plugin/
           ├── plugin.json
           └── plugin.ts
   ```
2. Go to **Admin > Plugins** and upload the ZIP file.
3. Click **Inactive** to activate the plugin.

Uploaded plugins are stored in `app/plugins/escalated/`.

### npm Package

Any npm package that includes a `plugin.json` at its root is automatically detected, including scoped packages:

```
npm install @acme/escalated-billing
```

The package just needs a `plugin.json` alongside its `package.json`:

```
node_modules/@acme/escalated-billing/
  package.json
  plugin.json        # ← Escalated detects this
  plugin.ts
  src/
    ...
```

npm plugins appear in the admin panel with a **composer** badge. They cannot be deleted from the UI — use `npm uninstall` instead.

**npm plugin slugs** are derived from the package name:
- `escalated-billing` stays as `escalated-billing`
- `@acme/escalated-billing` becomes `@acme--escalated-billing`

## Hook API

### Action Hooks

Actions let you run code when something happens. They don't return a value.

```typescript
import {
  escalated_addAction,
  escalated_hasAction,
  escalated_removeAction,
} from '@escalated-dev/escalated-adonis/support/helpers'

// Register an action
escalated_addAction(tag: string, callback: (...args: any[]) => Promise<void>, priority?: number): void

// Check if an action has callbacks
escalated_hasAction(tag: string): boolean

// Remove an action
escalated_removeAction(tag: string, callback?: Function): void
```

### Filter Hooks

Filters let you modify data as it passes through the system. Callbacks receive the current value and must return the modified value.

```typescript
import {
  escalated_addFilter,
  escalated_hasFilter,
  escalated_removeFilter,
} from '@escalated-dev/escalated-adonis/support/helpers'

// Register a filter
escalated_addFilter(tag: string, callback: (value: any, ...args: any[]) => Promise<any>, priority?: number): void

// Check if a filter has callbacks
escalated_hasFilter(tag: string): boolean

// Remove a filter
escalated_removeFilter(tag: string, callback?: Function): void
```

### Priority

Lower numbers run first. The default priority is `10`. Use lower values (e.g. `5`) to run before other callbacks, or higher values (e.g. `20`) to run after.

```typescript
// This runs first
escalated_addAction('ticket_created', async (ticket) => {
  // early processing
}, 5)

// This runs second
escalated_addAction('ticket_created', async (ticket) => {
  // later processing
}, 20)
```

## Available Hooks

### Plugin Lifecycle

| Hook | Args | When |
|------|------|------|
| `plugin_loaded` | `slug, manifest` | Plugin file is loaded |
| `plugin_activated` | `slug` | Plugin is activated |
| `plugin_activated_{slug}` | — | Your specific plugin is activated |
| `plugin_deactivated` | `slug` | Plugin is deactivated |
| `plugin_deactivated_{slug}` | — | Your specific plugin is deactivated |
| `plugin_uninstalling` | `slug` | Plugin is about to be deleted |
| `plugin_uninstalling_{slug}` | — | Your specific plugin is about to be deleted |

Use the `{slug}` variants to run code only for your own plugin:

```typescript
escalated_addAction('plugin_activated_my-plugin', async () => {
  // Run migrations, seed data, etc.
})

escalated_addAction('plugin_uninstalling_my-plugin', async () => {
  // Clean up database tables, cached files, etc.
})
```

## UI Helpers

Plugins can register UI elements that appear in the Escalated interface.

### Menu Items

```typescript
import { escalated_registerMenuItem } from '@escalated-dev/escalated-adonis/support/helpers'

escalated_registerMenuItem({
  label: 'Billing',
  url: '/support/admin/billing',
  icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5...',  // Heroicon SVG path
  section: 'admin',  // 'admin', 'agent', or 'customer'
  priority: 50,
})
```

### Dashboard Widgets

```typescript
import { escalated_registerDashboardWidget } from '@escalated-dev/escalated-adonis/support/helpers'

escalated_registerDashboardWidget({
  id: 'billing-summary',
  label: 'Billing Summary',
  component: 'BillingSummaryWidget',
  section: 'agent',
  priority: 10,
})
```

### Page Components (Slots)

Inject components into existing pages:

```typescript
import { escalated_addPageComponent } from '@escalated-dev/escalated-adonis/support/helpers'

escalated_addPageComponent(
  'ticket-detail',   // Page identifier
  'sidebar',         // Slot name
  {
    component: 'BillingInfo',
    props: { show_total: true },
    priority: 10,
  }
)
```

## Full Example: Slack Notifier Plugin

```
slack-notifier/
  plugin.json
  plugin.ts
```

**plugin.json:**
```json
{
    "name": "Slack Notifier",
    "slug": "slack-notifier",
    "description": "Posts a message to Slack when a new ticket is created.",
    "version": "1.0.0",
    "author": "Acme Corp",
    "main_file": "plugin.ts"
}
```

**plugin.ts:**
```typescript
import { escalated_addAction } from '@escalated-dev/escalated-adonis/support/helpers'
import env from '#start/env'

escalated_addAction('plugin_activated_slack-notifier', async () => {
  console.log('Slack Notifier plugin activated')
})

escalated_addAction('ticket_created', async (ticket) => {
  const webhookUrl = env.get('SLACK_WEBHOOK_URL')

  if (!webhookUrl) {
    return
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `New ticket *${ticket.reference}*: ${ticket.subject}`,
    }),
  })
})

escalated_addAction('plugin_uninstalling_slack-notifier', async () => {
  console.log('Slack Notifier plugin uninstalled')
})
```

## Full Example: npm Package

An npm-distributed plugin follows the same conventions. Your `package.json` and `plugin.json` live side by side:

**package.json:**
```json
{
  "name": "@acme/escalated-billing",
  "version": "2.0.0",
  "description": "Billing integration for Escalated",
  "main": "plugin.ts",
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@adonisjs/core": "^6.0.0"
  }
}
```

**plugin.json:**
```json
{
    "name": "Billing Integration",
    "slug": "@acme--escalated-billing",
    "description": "Adds billing and invoicing to Escalated.",
    "version": "2.0.0",
    "author": "Acme Corp",
    "main_file": "plugin.ts"
}
```

**plugin.ts:**
```typescript
import { escalated_addAction, escalated_registerMenuItem } from '@escalated-dev/escalated-adonis/support/helpers'
import { BillingService } from './src/billing_service.js'

escalated_addAction('ticket_created', async (ticket) => {
  const billingService = new BillingService()
  await billingService.trackTicket(ticket)
})

escalated_registerMenuItem({
  label: 'Billing',
  url: '/support/admin/billing',
  icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z',
  section: 'admin',
})
```

Since npm handles module resolution, your `plugin.ts` can import classes from `src/` using standard ES module imports.

## Tips

- **Keep plugin.ts lightweight.** Register hooks and delegate to service classes.
- **Use activation hooks** to run migrations or seed data on first activation.
- **Use uninstall hooks** to clean up database tables when your plugin is removed.
- **Namespace your hooks** to avoid collisions: `myplugin_custom_action`.
- **Test locally** by placing your plugin folder in `app/plugins/escalated/` and activating it from the admin panel.
- **npm plugins** benefit from the Node.js ecosystem, TypeScript support, testing infrastructure, and version management via npm registry.
