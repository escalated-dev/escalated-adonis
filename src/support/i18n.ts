import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Translation loader for escalated-adonis.
 *
 * Translations are merged from two sources, with later sources overriding
 * earlier ones on key conflict:
 *
 *   1. **Central package** (`@escalated-dev/locale`) — canonical translations
 *      shared across every Escalated host plugin. Resolved from
 *      `node_modules` at runtime.
 *   2. **Local overrides** (`resources/lang/{locale}/messages.json`) — keys
 *      shipped with this package that should win over the central source.
 *      Customers can also drop their own files under `resources/lang/overrides/`
 *      to layer host-app-specific overrides.
 *
 * Host apps using `@adonisjs/i18n` v3+ should configure two `fs` loaders in
 * `config/i18n.ts` — see the README for the canonical chain.
 */

const translations: Record<string, Record<string, any>> = {}
let currentLocale = 'en'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDirPath = dirname(currentFilePath)
const localLangDir = join(currentDirPath, '../../resources/lang')

/**
 * Resolve the central `@escalated-dev/locale` package's lang directory.
 *
 * Returns `null` if the package is not installed (e.g. during early bootstrap
 * before `npm install` has run, or in a stripped-down test fixture).
 */
function resolveCentralLangDir(): string | null {
  try {
    const require = createRequire(import.meta.url)
    const pkgJsonPath = require.resolve('@escalated-dev/locale/package.json')
    return join(dirname(pkgJsonPath), 'locales')
  } catch {
    return null
  }
}

/**
 * Recursively collect every JSON file under `dir` and merge its contents into
 * `target` keyed by relative path. Sub-directories yield nested keys so a file
 * `dir/foo/bar.json` becomes `target.foo.bar`.
 */
function loadJsonTree(dir: string): Record<string, any> {
  if (!existsSync(dir)) return {}
  const out: Record<string, any> = {}

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out[entry] = loadJsonTree(full)
    } else if (entry.endsWith('.json')) {
      const key = entry.replace(/\.json$/, '')
      try {
        const parsed = JSON.parse(readFileSync(full, 'utf-8'))
        // For the canonical `messages.json` file, hoist its keys to the top
        // level so existing call sites (`t('tickets.created')`) keep working.
        if (key === 'messages' && parsed && typeof parsed === 'object') {
          Object.assign(out, parsed)
        } else {
          out[key] = parsed
        }
      } catch {
        // Ignore unparseable JSON; treat as missing.
      }
    }
  }

  return out
}

/**
 * Deep-merge `source` into `target`. `source` wins on conflict at any depth.
 * Pure values (strings, numbers, arrays) replace; only plain objects merge.
 */
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      target[key] = deepMerge({ ...target[key] }, value)
    } else {
      target[key] = value
    }
  }
  return target
}

function loadLocale(locale: string): Record<string, any> {
  const merged: Record<string, any> = {}

  // 1. Base: central package translations
  const centralDir = resolveCentralLangDir()
  if (centralDir) {
    deepMerge(merged, loadJsonTree(join(centralDir, locale)))
  }

  // 2. Override: this package's bundled local translations
  deepMerge(merged, loadJsonTree(join(localLangDir, locale)))

  // 3. Override: host-app `resources/lang/overrides/{locale}/` if present
  //    (only meaningful when the package is invoked from a host app's
  //    runtime cwd; harmless otherwise).
  deepMerge(merged, loadJsonTree(join(localLangDir, 'overrides', locale)))

  return merged
}

// Eagerly load all known locales at module-init time.
for (const locale of [
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'it',
  'ja',
  'ko',
  'nl',
  'pl',
  'pt-BR',
  'ru',
  'tr',
  'zh-CN',
]) {
  translations[locale] = loadLocale(locale)
}

export function setLocale(locale: string) {
  currentLocale = locale
}

export function getLocale(): string {
  return currentLocale
}

export function t(key: string, replacements?: Record<string, string | number>): string {
  const keys = key.split('.')
  let value: any = translations[currentLocale]

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      // Fallback to English
      value = translations['en']
      for (const fk of keys) {
        if (value && typeof value === 'object' && fk in value) {
          value = value[fk]
        } else {
          return key // Return key if not found
        }
      }
      break
    }
  }

  if (typeof value !== 'string') return key

  if (replacements) {
    for (const [rKey, rValue] of Object.entries(replacements)) {
      value = value.replace(`:${rKey}`, String(rValue))
    }
  }

  return value
}
