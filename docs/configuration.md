# Configuration

## Configuration

Edit `config/escalated.ts` to customize behavior:

```typescript
const escalatedConfig: EscalatedConfig = {
  // Hosting mode: 'self-hosted' | 'synced' | 'cloud'
  mode: 'self-hosted',

  // Your app's user model import path
  userModel: '#models/user',

  // Route configuration. Middleware are named as in router.named() in
  // your start/kernel.ts; adminMiddleware runs before Escalated's own
  // agent and admin checks.
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

### Host user key type (UUID / string users)

Escalated stores references to your app's users (ticket requester, assignee,
reply author, etc.). By default those columns are integers. If your `User`
model's primary key is a **UUID or other string**, set
`ESCALATED_USER_KEY_TYPE` before running the Escalated migrations so the FK
columns are created as `varchar(255)` instead of `integer`:

```dotenv
# .env — one of: int (default) | bigint | uuid | string
ESCALATED_USER_KEY_TYPE=uuid
```

It is read from the environment (not the config object) because Lucid
migrations run before app config is fully available. Existing integer-keyed
installs need no change — the default (`int`) produces the same schema as
before. All Escalated code paths accept a host user id as either a `number` or
a `string` (`UserId`).

### Authorization

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

### Ticket subjects

A ticket has a **requester** (who raised it) and a **subject line** (free text). Tickets can also be *about* host-app entities — a Project, Customer, asset — that are not people. Attach them as ticket **subjects** so agents see what the ticket concerns and can jump into your app.

Implement the `TicketSubject` contract on any host model (or resolve presentation via config):

```typescript
import type { TicketSubject } from '@escalated-dev/escalated-adonis'

export class Project implements TicketSubject {
  ticketSubjectTitle() {
    return this.name
  }
  ticketSubjectSubtitle() {
    return `Project · ${this.customerName}`
  }
  ticketSubjectUrl() {
    return `/projects/${this.id}`
  }
  ticketSubjectColor() {
    return '#2563eb'
  }
  ticketSubjectIcon() {
    return 'folder'
  }
}
```

Attach, detach, or sync on a ticket (several subjects allowed; `subject_id` is stored as a string):

```typescript
await ticket.attachSubject('Project', project.id, 'project')
await ticket.detachSubject('Project', project.id)
await ticket.syncSubjects([
  { type: 'Project', id: project.id, role: 'primary' },
  ['Customer', customer.id, 'account'],
])
```

Configure allowed types and a resolver for API/UI serialization:

```typescript
ticketSubjects: {
  types: ['Project', 'Customer'],
  resolver: async (type, id) => {
    if (type === 'Project') {
      const row = await Project.find(id)
      return row ?? null
    }
    return null
  },
},
```

Agent/admin routes: `POST …/tickets/:ticket/subjects` (`type`, `id`, optional `role`) and `DELETE …/tickets/:ticket/subjects/:linkId`. The API only accepts allowlisted types; programmatic `attachSubject()` allows any type when the allowlist is empty.

Each subject is serialized as `{ type, id, role, title, subtitle, url, color, icon, missing }` (fallback title `type#id` when the resolver is absent or returns null).

## Scheduled commands

Time-based features only happen when their Ace command runs, so run these from cron, a process manager or a scheduler package:

| Command | Suggested schedule | What it does |
| --- | --- | --- |
| `node ace escalated:check-sla` | every minute | Flags SLA breaches and emits `escalated:sla:breached`; emits `escalated:sla:warning` for targets due within `--warning-minutes` (default 30) |
| `node ace escalated:wake-snoozed-tickets` | every minute | Wakes tickets whose snooze has ended |
| `node ace escalated:plugins:cron` | every minute | Runs SDK plugins' due `cron` schedules |
| `node ace escalated:run-escalations` | every 5 minutes | Applies escalation rules |
| `node ace escalated:run-automations` | every 5 minutes | Applies automations |
| `node ace escalated:close-idle-chats` | every 5 minutes | Closes chat sessions idle beyond the threshold |
| `node ace escalated:cleanup-abandoned-chats` | every 5 minutes | Cleans up chat sessions abandoned in the queue |
| `node ace escalated:newsletters:dispatch` | every minute | Plans due newsletters and dispatches pending deliveries |
| `node ace escalated:purge-expired` | daily | Applies the Data Retention settings (all `never` by default, which purges nothing); `--dry-run` reports only, `--force` deletes expired closed tickets instead of soft-deleting them |

For example, with cron:

```
* * * * * cd /path/to/app && node ace escalated:check-sla
*/5 * * * * cd /path/to/app && node ace escalated:run-escalations
```

`node ace configure @escalated-dev/escalated-adonis` registers the commands. An app configured before it did needs the loader added to the `commands` array in `adonisrc.ts` by hand:

```ts
commands: [
  // ...your other commands
  () => import('@escalated-dev/escalated-adonis/commands'),
],
```

## Database connection

By default Escalated's tables live on your application's default Lucid
connection. Name a different one to keep them somewhere else — a schema shared
with a legacy system, a multi-tenant split, a separate reporting store, or
simply out of your primary database:

```ts
// config/escalated.ts
export default defineConfig({
  connection: 'support',
})
```

`'support'` is a connection from your `config/database.ts`. Omit it entirely for
the default connection, which is the historical behaviour — an unconfigured host
is unchanged.

Every Escalated model extends `EscalatedBaseModel`, so one setting moves all of
them together. Lucid normally takes a static connection string on the model;
this is a getter instead, because the value comes from runtime config that is
not loaded when the model classes are defined. A test enumerates `src/models`
and fails if a model is ever added that does not extend the base class.

**Your user table does not move.** It belongs to your application, and Escalated
stores host user ids as plain unconstrained columns precisely so the two can
live on different connections — there is no foreign key that would have to span
them. The importer's user lookup deliberately stays on the default connection
for the same reason.

### Migrations

Lucid decides which database a migration runs against from the connection you
pass, so run Escalated's against the same one:

```bash
node ace migration:run --connection=support
```

Setting `connection` on an existing install does not move existing data. Migrate
the tables and copy the rows across before pointing Escalated at them.
