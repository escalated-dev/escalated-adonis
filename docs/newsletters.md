# Newsletters

## Newsletters (optional, disabled by default)

Admin-only broadcast feature for sending Markdown emails to contacts. Off by default — instantiate `NewsletterDispatcher` with `{ enableNewsletters: true }` and run `dispatchBatch()` on a cron.

```ts
import NewsletterDispatcher from '@escalated-dev/escalated-adonis/services/newsletter/newsletter_dispatcher'
import { marked } from 'marked'

const dispatcher = new NewsletterDispatcher({
  enableNewsletters: true,
  batchSize: 50,
  rendererOptions: {
    baseUrl: 'https://support.example.com',
    appName: 'Acme',
    trackingEnabled: true,
    markdownToHtml: (md) => marked.parse(md, { async: false }) as string,
    brand: {
      name: 'Acme',
      accent: '#2563eb',
      physicalAddress: 'Acme Inc. · 123 Main St · Springfield USA',
    },
  },
})

await dispatcher.dispatchBatch()
```

Custom themes go in `resources/views/newsletter_themes/<slug>.edge`. The shipped renderer supports the `{{ key }}` / `{{{ key }}}` substitution subset.
