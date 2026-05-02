# Translation Overrides

Translations in escalated-adonis are loaded from three layers, in order:

1. **Central package** — `@escalated-dev/locale` (canonical strings shared
   across every Escalated host plugin).
2. **Bundled local** — `resources/lang/{locale}/messages.json` shipped with
   this package (this directory's siblings).
3. **Host overrides** — `resources/lang/overrides/{locale}/messages.json`
   (this directory).

Later layers win on key conflict via deep-merge — only the keys you specify
get overridden; the rest fall through to the central package.

## When to add an override here

- A string in the central package reads correctly but you want different
  wording for this AdonisJS-specific surface.
- You ship a stub/page that introduces a new key and the central package has
  not yet been updated to include it.
- You need a temporary fix while a translation PR lands upstream in
  `@escalated-dev/escalated-locale`.

## When NOT to add an override here

- The string is wrong for everyone — open a PR against
  [`escalated-dev/escalated-locale`](https://github.com/escalated-dev/escalated-locale)
  instead so every host plugin benefits.

## Format

Identical to the bundled local files — one `messages.json` per locale:

```
resources/lang/overrides/en/messages.json
resources/lang/overrides/de/messages.json
resources/lang/overrides/fr/messages.json
```

Only include the keys you actually want to override; everything else
falls through.

## Host applications

If your AdonisJS app uses `@adonisjs/i18n` v3+ directly, you can chain its
`fs` loaders the same way in `config/i18n.ts`:

```ts
import { defineConfig, formatters, loaders } from '@adonisjs/i18n'
import app from '@adonisjs/core/services/app'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const centralLocale = require.resolve('@escalated-dev/locale/package.json')
const centralDir = new URL('./locales', `file://${centralLocale}`).pathname

export default defineConfig({
  formatter: formatters.icu(),
  defaultLocale: 'en',
  loaders: [
    // Base layer: central package translations.
    loaders.fs({ location: centralDir }),
    // Override layer: host app's own resources/lang/.
    loaders.fs({ location: app.languageFilesPath() }),
  ],
})
```

The last loader in the array wins on key conflict, matching the override
semantics of this package's internal loader.
