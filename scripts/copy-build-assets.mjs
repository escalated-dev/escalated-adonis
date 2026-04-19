// Copy non-TS runtime assets into build/ so the published package is
// self-contained — `configure.js` resolves stubs and migrations
// relative to its own URL (build/configure.js), so the .stub files and
// the .ts migration sources need to live alongside it under build/.

import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BUILD = join(ROOT, 'build')

function copyTree(srcRel, dstRel, label) {
  const src = join(ROOT, srcRel)
  const dst = join(BUILD, dstRel)
  if (!existsSync(src)) {
    console.log(`[copy-assets] ${label}: source ${src} not found, skipping`)
    return
  }
  mkdirSync(dst, { recursive: true })
  cpSync(src, dst, { recursive: true })
  const count = readdirSync(dst, { recursive: true }).length
  console.log(`[copy-assets] ${label}: copied ${src} → ${dst} (${count} entries)`)
}

copyTree('stubs', 'stubs', 'stubs')
copyTree('database/migrations', 'database/migrations', 'migrations')
