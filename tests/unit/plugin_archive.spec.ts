import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectSafeArchiveRootFolder } from '../../src/support/plugin_archive.ts'

describe('plugin upload archive validation', () => {
  const pluginsPath = join(tmpdir(), 'escalated-adonis-plugin-upload')

  it('accepts a valid single-root plugin archive', () => {
    const root = collectSafeArchiveRootFolder(
      ['valid-plugin/plugin.json', 'valid-plugin/Plugin.js'],
      pluginsPath
    )

    assert.equal(root, 'valid-plugin')
  })

  it('rejects traversal entries before extraction', () => {
    assert.throws(
      () =>
        collectSafeArchiveRootFolder(
          ['safe-plugin/plugin.json', 'safe-plugin/../../outside.txt'],
          pluginsPath
        ),
      /Invalid plugin archive: unsafe entry path/
    )
  })

  it('rejects archives with multiple plugin roots', () => {
    assert.throws(
      () => collectSafeArchiveRootFolder(['first/plugin.json', 'second/plugin.json'], pluginsPath),
      /expected exactly one root plugin folder/
    )
  })

  it('rejects unsafe root folder names', () => {
    assert.throws(
      () => collectSafeArchiveRootFolder(['bad name/plugin.json'], pluginsPath),
      /unsafe root plugin folder name/
    )
  })
})
