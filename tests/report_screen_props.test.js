import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

/*
|--------------------------------------------------------------------------
| Report Screen Props
|--------------------------------------------------------------------------
|
| The report screens are handed the props they actually read.
|
| A page name that resolves is not a screen that works. Inertia passes props by
| name, and a name the component does not declare is not passed at all -- it
| lands on the root element as an attribute. The screen renders its defaults,
| which for a report is zeroes and empty charts, on a 200, and that is
| indistinguishable from a quiet period.
|
| Every action in AdminAdvancedReportsController used to send { data, filters },
| which no report component reads. All nine screens were empty, and six of them
| rendered page names the frontend does not ship at all.
|
| This repo's suite mocks its repository layer, so there is no request to
| inspect. What it can check without one is the source: which literal prop keys
| each render site passes, against what the frontend publishes that the
| component reads. That catches the whole of the fault that was here -- a
| controller sending names nothing declares.
|
*/

const require = createRequire(import.meta.url)
const MANIFEST = require('@escalated-dev/escalated/pages.json')

const CONTROLLER = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'controllers',
  'admin_advanced_reports_controller.ts'
)

/**
 * Every `render(ctx, 'Escalated/...', { ... })` in the controller, as a page
 * name and the literal keys of the object it is handed.
 */
function renderSites() {
  const source = readFileSync(CONTROLLER, 'utf8')
  const sites = []

  const pattern = /render\(ctx, '(Escalated\/[A-Za-z0-9/_]+)', \{/g

  for (const match of source.matchAll(pattern)) {
    const start = match.index + match[0].length - 1
    let depth = 0
    let end = start

    // Walk to the matching brace so nested objects and arrays come along.
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1
      if (source[i] === '}') depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }

    const body = source.slice(start + 1, end)
    const keys = []
    let nesting = 0

    for (const line of body.split('\n')) {
      const trimmed = line.trim()
      const key = nesting === 0 ? /^([a-z_][a-z0-9_]*):/.exec(trimmed) : null

      if (key) keys.push(key[1])

      nesting += (line.match(/[{[(]/g) || []).length
      nesting -= (line.match(/[}\])]/g) || []).length
    }

    sites.push({ page: match[1], keys })
  }

  return sites
}

describe('report screen props', () => {
  it('passes every prop the screen declares, and nothing it does not', () => {
    const sites = renderSites()

    assert.ok(
      sites.length >= 6,
      `found only ${sites.length} render sites, which is fewer than there are screens`
    )

    const problems = []

    for (const { page, keys } of sites) {
      const declared = MANIFEST.props[page]?.props

      assert.ok(declared, `the manifest does not describe ${page}`)

      const missing = declared.filter((prop) => !keys.includes(prop))
      const unread = keys.filter((key) => !declared.includes(key))

      if (missing.length) {
        problems.push(
          `${page} declares props this render never passes, so they fall back to their defaults:\n  ${missing.join('\n  ')}`
        )
      }

      if (unread.length) {
        problems.push(
          `${page} is passed props it does not declare, so they are dropped on the root element:\n  ${unread.join('\n  ')}`
        )
      }
    }

    assert.deepEqual(problems, [], problems.join('\n\n'))
  })

  it('has a manifest that describes props at all', () => {
    // A manifest that lost its props would make the test above pass by
    // comparing against nothing.
    assert.ok(MANIFEST.props, 'the manifest publishes no props')
    assert.ok(Object.keys(MANIFEST.props).length > 50)
    assert.deepEqual(MANIFEST.props['Escalated/Admin/Reports/AgentRanking'].props, [
      'agents',
      'period_days',
    ])
  })

  it('reads the render sites rather than finding none', () => {
    // A regex that stopped matching would report a clean controller for the
    // same reason an empty manifest would.
    const pages = renderSites().map((site) => site.page)

    assert.ok(pages.includes('Escalated/Admin/Reports/SlaTrends'))
    assert.ok(pages.includes('Escalated/Admin/Reports/Comparison'))
  })
})
