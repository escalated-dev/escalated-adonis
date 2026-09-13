import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * `selfAssignPrimaryKey = true` tells Lucid the application sets a model's id
 * before inserting it, so Lucid never reads back an id the database generates.
 * On a table whose id is auto-increment, every model created that way has no
 * id: `Ticket` did this, and `TicketService.create` failed before it could
 * emit `ticket.created`.
 *
 * Asserted from source, like the connection test next to this one: this suite
 * runs under plain node, where the models' `.js`-suffixed imports do not
 * resolve. Reading the files also catches a model added later.
 */

const root = join(import.meta.dirname, '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return walk(path)
    return entry.endsWith('.ts') ? [path] : []
  })
}

/** Models declaring `selfAssignPrimaryKey = true`, with the table each maps to. */
function modelsThatSelfAssign(): Array<{ model: string; table: string | null }> {
  return walk(join(root, 'src', 'models'))
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => /static\s+selfAssignPrimaryKey\s*=\s*true/.test(source))
    .map(({ path, source }) => ({
      model: relative(root, path).split(sep).join('/'),
      table: /static\s+table\s*=\s*'([^']+)'/.exec(source)?.[1] ?? null,
    }))
}

/** Every model's table, to show the scan read the models at all. */
function modelTables(): string[] {
  return walk(join(root, 'src', 'models'))
    .map((path) => /static\s+table\s*=\s*'([^']+)'/.exec(readFileSync(path, 'utf8'))?.[1])
    .filter((table): table is string => Boolean(table))
}

/** Tables the migrations create with an auto-increment `id`. */
function autoIncrementTables(): Set<string> {
  const tables = new Set<string>()

  for (const path of walk(join(root, 'database', 'migrations'))) {
    const source = readFileSync(path, 'utf8')
    const tableName = /tableName\s*=\s*'([^']+)'/.exec(source)?.[1]

    // Each createTable call runs up to the next one.
    for (const segment of source.split('createTable(').slice(1)) {
      const named = /^\s*'([^']+)'/.exec(segment)?.[1]
      const table = named ?? (/^\s*this\.tableName\b/.test(segment) ? tableName : undefined)
      if (table && /\b(?:increments|bigIncrements)\(\s*'id'/.test(segment)) {
        tables.add(table)
      }
    }
  }

  return tables
}

describe('model primary keys', () => {
  it('reads the models and migrations it checks', () => {
    assert.ok(modelTables().length >= 40, 'expected to find the package models')
    assert.ok(autoIncrementTables().has('escalated_tickets'))
  })

  it('never self-assigns the primary key of a table whose id is auto-increment', () => {
    const autoIncrement = autoIncrementTables()
    const offenders = modelsThatSelfAssign()
      .filter(({ table }) => table !== null && autoIncrement.has(table))
      .map(({ model, table }) => `${model} (${table})`)

    assert.deepEqual(offenders, [])
  })
})
