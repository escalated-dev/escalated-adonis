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
 * These nine advanced-report endpoints pass `{ data, filters }`, while every
 * report component in the frontend takes flat props (`period_days`, `trend`,
 * `by_agent`, ...). Three of the nine resolve by name and still render an empty
 * report because every prop falls back to its default; these six do not resolve
 * at all. Renaming them would turn this test green and leave the screens just
 * as blank, so they stay listed until the controllers are reworked to match the
 * components -- which also means collapsing the three FRT endpoints into the
 * one ResponseTimes screen, and the two resolution endpoints into
 * ResolutionTimes.
 *
 * This list may shrink. It must never grow.
 */
const KNOWN_BLANK = [
  'Escalated/Admin/Reports/Cohort',
  'Escalated/Admin/Reports/FrtByAgent',
  'Escalated/Admin/Reports/FrtDistribution',
  'Escalated/Admin/Reports/FrtTrends',
  'Escalated/Admin/Reports/ResolutionDistribution',
  'Escalated/Admin/Reports/ResolutionTrends',
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
  const lines = ['these page names have no component in @escalated-dev/escalated, so they render a blank panel:']

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

    assert.ok(rendered.size > 0, 'found no page names at all, which means this test is not looking where it should')

    const missing = [...rendered.keys()].filter((name) => !SHIPPED.includes(name) && !KNOWN_BLANK.includes(name)).sort()

    assert.deepEqual(missing, [], explain(missing, rendered))
  })

  it('the manifest is present and looks like one', () => {
    // A manifest that arrived empty would make the test above pass by
    // comparing against nothing.
    assert.ok(Array.isArray(SHIPPED))
    assert.ok(SHIPPED.length > 50, `manifest has only ${SHIPPED.length} pages`)
    assert.ok(SHIPPED.every((name) => name.startsWith('Escalated/')))
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
