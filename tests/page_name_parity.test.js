import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/*
|--------------------------------------------------------------------------
| Page Name Parity
|--------------------------------------------------------------------------
|
| Every page name this package renders has to resolve to a component in
| @escalated-dev/escalated.
|
| Inertia resolving a name to nothing is not an error. The response is a 200,
| the resolver returns undefined, Vue renders nothing, and the panel comes up
| blank -- which reads as a permissions problem or an empty dataset. Four
| screens shipped that way across this portfolio before anyone noticed.
|
| Neither repo's tests can see it alone: a controller test asserts a status,
| and the frontend never hears the name. This is the comparison. The list comes
| from the installed package rather than a copy, so it cannot go stale -- a
| frontend release that renames a page turns this test red here.
|
| Adding a screen goes: component into the frontend, frontend release, bump the
| devDependency, then render the name here. In that order, or it ships blank.
|
*/

const require = createRequire(import.meta.url)
const SHIPPED = require('@escalated-dev/escalated/pages.json').pages

/**
 * Names that render a blank panel today, and are not fixed by renaming.
 *
 * Empty. The advanced reports were the whole of this list; they now render the
 * screens the frontend ships, with the props those screens read. Anything added
 * here needs the reason written against it, and the last test in this file
 * fails if an entry stays after the screen is fixed.
 *
 * This list may shrink. It must never grow.
 */
const KNOWN_BLANK = []

/**
 * Pages the frontend ships that this package does not render yet, so a page
 * cannot go missing without the list saying so. Rendering one means removing
 * it here; the last test fails if an entry is rendered or no longer shipped.
 *
 * Grouped by why. Features this package does not have are listed so the gap
 * is visible, not because a render is coming soon.
 */
const NOT_YET_RENDERED = [
  // Features this package does not have.
  'Escalated/Admin/BusinessHours/Form',
  'Escalated/Admin/BusinessHours/Index',
  'Escalated/Admin/Statuses/Form',
  'Escalated/Admin/Statuses/Index',
  'Escalated/Admin/Settings/DataRetention',
  'Escalated/Admin/Settings/DatabaseConnection',
  'Escalated/Admin/Settings/EmailSettings',
  'Escalated/Admin/Settings/Sandbox',
  // SSO: SsoService parses assertions, but there is no sign-in route that
  // uses it, and SAML responses are not signature-checked. A settings screen
  // would configure a sign-in that does not exist.
  'Escalated/Admin/Settings/SsoSettings',
  // The import wizard here is job-based (create, map, start); Connect and
  // Review belong to escalated-laravel's platform-based flow
  // (connect, test-connection, mapping, review, start), not ported.
  'Escalated/Admin/Import/Connect',
  'Escalated/Admin/Import/Review',
  // Not rendered by escalated-laravel either: the builder is part of
  // Workflows/Form, and errors render through the host.
  'Escalated/Admin/Workflows/Builder',
  'Escalated/Error',
]

const PAGE_NAME = /'(Escalated\/[A-Za-z0-9/_]+)'/g

/**
 * Page names rendered anywhere in src/, mapped to the files that render them,
 * so a failure can name the file and not only the string.
 */
function renderedPages() {
  const root = fileURLToPath(new URL('../src/', import.meta.url))
  const found = new Map()

  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) {
        walk(path)
        continue
      }
      if (!entry.endsWith('.ts')) continue

      for (const [, name] of readFileSync(path, 'utf8').matchAll(PAGE_NAME)) {
        if (!found.has(name)) found.set(name, new Set())
        found.get(name).add(relative(root, path).split(sep).join('/'))
      }
    }
  }

  walk(root)

  return found
}

function explain(missing, rendered) {
  const lines = [
    'these page names have no component in @escalated-dev/escalated, so they render a blank panel:',
  ]

  for (const name of missing) {
    lines.push(`  ${name}  (${[...rendered.get(name)].join(', ')})`)
  }

  lines.push('')
  lines.push('Either the name is wrong, or the component has not been released yet.')
  lines.push('If it has been: bump @escalated-dev/escalated.')

  return lines.join('\n')
}

describe('page name parity', () => {
  it('renders only page names the frontend ships', () => {
    const rendered = renderedPages()

    assert.ok(
      rendered.size > 0,
      'found no page names at all, which means this test is not looking where it should'
    )

    const missing = [...rendered.keys()]
      .filter((name) => !SHIPPED.includes(name) && !KNOWN_BLANK.includes(name))
      .sort()

    assert.deepEqual(missing, [], explain(missing, rendered))
  })

  it('the manifest is present and looks like one', () => {
    // A manifest that arrived empty would make the test above pass by
    // comparing against nothing.
    assert.ok(Array.isArray(SHIPPED))
    assert.ok(SHIPPED.length > 50, `manifest has only ${SHIPPED.length} pages`)
    assert.ok(SHIPPED.every((name) => name.startsWith('Escalated/')))
  })

  it('accounts for every shipped page: rendered here, or listed as not yet rendered', () => {
    const rendered = renderedPages()

    const unaccounted = SHIPPED.filter(
      (name) => !rendered.has(name) && !NOT_YET_RENDERED.includes(name)
    ).sort()
    const stale = NOT_YET_RENDERED.filter((name) => rendered.has(name) || !SHIPPED.includes(name))

    assert.deepEqual(
      unaccounted,
      [],
      `these shipped pages are neither rendered nor listed in NOT_YET_RENDERED:\n  ${unaccounted.join('\n  ')}`
    )
    assert.deepEqual(
      stale,
      [],
      `these names are in NOT_YET_RENDERED but are rendered now, or no longer shipped -- remove them:\n  ${stale.join('\n  ')}`
    )
  })

  it('does not keep excusing names that have been fixed', () => {
    // The exception list is a record of work still owed. Leaving an entry in
    // it after the screen is fixed is how the list stops meaning anything.
    const rendered = renderedPages()

    const stale = KNOWN_BLANK.filter((name) => !rendered.has(name) || SHIPPED.includes(name))

    assert.deepEqual(
      stale,
      [],
      `these names are on the blank-screen exception list but no longer need to be -- remove them:\n  ${stale.join('\n  ')}`
    )
  })
})
