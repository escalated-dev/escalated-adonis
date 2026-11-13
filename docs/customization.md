# Customization

## Custom Ticket Actions

Host applications can add custom buttons to the agent ticket screen and handle
clicks with a normal event listener. Register actions in `config/escalated.ts`:

```ts
const escalatedConfig: EscalatedConfig = {
  // ...
  ticketActions: {
    actions: [
      {
        key: 'sync-crm',
        label: 'Sync CRM',
        variant: 'primary',                // primary | secondary | danger
        confirmation: 'Sync this ticket to the CRM?',
        metadata: { icon: 'refresh-cw' },
        // visible / enabled may be a boolean or (ticket, user) => boolean
        enabled: (ticket) => !ticket.metadata?.crm_synced,
      },
    ],
  },
}
```

For richer logic, an entry may instead be an object implementing the
`TicketAction` contract (`src/contracts/ticket_action.ts`).

Visible actions are exposed on the agent ticket show page as `customActions`
and on the API ticket detail response as `custom_actions` (each with a `url`
and `method`). Triggering one (`POST /<prefix>/agent/tickets/:ticket/actions/:action`
or the API equivalent) validates the action is visible (404) and enabled (403),
then emits `escalated:ticket:customActionTriggered`:

```ts
import emitter from '@adonisjs/core/services/emitter'
import { ESCALATED_EVENTS } from '@escalated-dev/escalated-adonis'

emitter.on(ESCALATED_EVENTS.TICKET_CUSTOM_ACTION_TRIGGERED, async (data) => {
  if (data.action !== 'sync-crm') return
  // data.ticket, data.user, data.payload, data.metadata
})
```

Escalated also records an internal note on the ticket whenever an action fires,
for auditability.

## Using Services Directly

You can resolve services from the container for custom logic:

```typescript
import app from '@adonisjs/core/services/app'

const ticketService = await app.container.make('escalated.ticketService')
const ticket = await ticketService.create({
  subject: 'Help needed',
  description: 'I have a question...',
  priority: 'medium',
  channel: 'api',
}, { id: 1, type: 'User' }) // requester

const assignmentService = await app.container.make('escalated.assignmentService')
await assignmentService.autoAssign(ticket)
```

## Translations (i18n)

Translations are sourced from the central [`@escalated-dev/locale`](https://github.com/escalated-dev/escalated-locale)
npm package and shared with every Escalated host plugin (Laravel, Rails,
Django, Spring, etc.). Three layers are merged at runtime, with later
layers winning on key conflict:

1. **Central package** — `@escalated-dev/locale/locales/{locale}/`
2. **Bundled local** — `resources/lang/{locale}/messages.json` (this package)
3. **Host overrides** — `resources/lang/overrides/{locale}/messages.json`

To override a single string in your host app, create a file under
`resources/lang/overrides/{locale}/messages.json` containing only the keys
you want to change — everything else falls through to the central package.

If your host app uses `@adonisjs/i18n` v3+ directly (in addition to the
plugin's own `t()` helper), see `resources/lang/overrides/README.md` for a
sample `config/i18n.ts` that chains `loaders.fs()` against the central
package and your host's `app.languageFilesPath()`.
