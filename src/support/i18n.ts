import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

let translations: Record<string, any> = {}
let currentLocale = 'en'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const langDir = join(__dirname, '../../resources/lang')

function loadLocale(locale: string): Record<string, any> {
  const filePath = join(langDir, locale, 'messages.json')
  if (existsSync(filePath)) {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  }
  return {}
}

// Load all locales at startup
for (const locale of ['en', 'es', 'fr', 'de']) {
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
