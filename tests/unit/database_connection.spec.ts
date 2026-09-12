import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { connectionName, table, tablePrefix } from '../../src/helpers/config.ts'

/**
 * Escalated's tables resolved the host application's default Lucid connection
 * with no way to change it, which made the package unusable in any host that
 * partitions its database.
 *
 * `connection` on the Escalated config names where they live instead, and every
 * model reads it through one base class.
 *
 * The model coverage below is asserted from source rather than by importing the
 * models: this suite runs under plain node, and the models' `.js`-suffixed
 * imports do not resolve there. Reading the directory is also the stronger
 * check -- it catches a model added later that forgets the base class, which is
 * the regression actually worth guarding.
 */
function setConfig(config: Record<string, unknown>) {
  ;(globalThis as any).__escalated_config = config
}

let original: unknown

beforeEach(() => {
  original = (globalThis as any).__escalated_config
})

afterEach(() => {
  ;(globalThis as any).__escalated_config = original
})

describe('escalated database connection', () => {
  it('is undefined when nothing is configured, keeping the host default', () => {
    setConfig({})
    assert.equal(connectionName(), undefined)
  })

  it('is undefined when the config object is absent entirely', () => {
    ;(globalThis as any).__escalated_config = undefined
    assert.equal(connectionName(), undefined)
  })

  it('returns the configured connection', () => {
    setConfig({ connection: 'support' })
    assert.equal(connectionName(), 'support')
  })

  it('treats an empty connection name as unset', () => {
    // An empty string is what an unset environment variable reads as, and is
    // not a connection anyone meant to configure.
    setConfig({ connection: '' })
    assert.equal(connectionName(), undefined)
  })

  it('tracks configuration rather than freezing at import time', () => {
    // Lucid normally takes a static connection string. The config is not
    // loaded when the model classes are defined, which is why the base model
    // exposes a getter -- this is the behaviour that makes that work.
    setConfig({ connection: 'support' })
    assert.equal(connectionName(), 'support')

    setConfig({ connection: 'archive' })
    assert.equal(connectionName(), 'archive')
  })

  it('is independent of the table prefix', () => {
    setConfig({ connection: 'support', tablePrefix: 'support_' })

    assert.equal(connectionName(), 'support')
    assert.equal(tablePrefix(), 'support_')
    assert.equal(table('tickets'), 'support_tickets')
  })
})

describe('escalated models', () => {
  const modelsDir = join(import.meta.dirname, '..', '..', 'src', 'models')
  const modelFiles = readdirSync(modelsDir).filter(
    (file) => file.endsWith('.ts') && file !== 'base_model.ts'
  )

  it('finds the model directory', () => {
    assert.ok(modelFiles.length > 0, 'no model files found; the sweep below would pass vacuously')
  })

  it('all extend the escalated base model, which carries the connection', () => {
    const offenders: string[] = []

    for (const file of modelFiles) {
      const source = readFileSync(join(modelsDir, file), 'utf8')

      if (!/\bexport default class \w+ extends \w+/.test(source)) {
        continue
      }

      if (!/\bextends EscalatedBaseModel\b/.test(source)) {
        offenders.push(file)
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `these models do not extend EscalatedBaseModel and would stay on the host's default connection: ${offenders.join(', ')}`
    )
  })

  it('no model extends Lucid BaseModel directly any more', () => {
    const offenders = modelFiles.filter((file) =>
      /\bextends BaseModel\b/.test(readFileSync(join(modelsDir, file), 'utf8'))
    )

    assert.deepEqual(offenders, [], `still extending Lucid BaseModel: ${offenders.join(', ')}`)
  })
})
