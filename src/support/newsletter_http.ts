import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

export class NewsletterValidationError extends Error {
  constructor(
    message: string,
    readonly errors: Record<string, string> = { _error: message }
  ) {
    super(message)
    this.name = 'NewsletterValidationError'
  }
}

export function discoverNewsletterThemes(themesDir?: string): string[] {
  const dirs = [
    themesDir,
    join(moduleDir, '../../resources/views/newsletter_themes'),
    join(process.cwd(), 'resources/views/newsletter_themes'),
  ].filter(Boolean) as string[]

  const themes = new Set<string>()
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.edge') || file.endsWith('.hbs')) {
        themes.add(file.replace(/\.(edge|hbs)$/, ''))
      }
    }
  }
  return themes.size > 0 ? [...themes] : ['default', 'branded']
}

export function requiredString(body: any, key: string, max?: number): string {
  const value = body?.[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new NewsletterValidationError(`${key} is required`, { [key]: `${key} is required` })
  }
  if (max && value.length > max) {
    throw new NewsletterValidationError(`${key} may not be greater than ${max} characters`, {
      [key]: `${key} may not be greater than ${max} characters`,
    })
  }
  return value
}

export function optionalString(body: any, key: string, max?: number): string | null {
  const value = body?.[key]
  if (value == null || value === '') return null
  if (typeof value !== 'string') {
    throw new NewsletterValidationError(`${key} must be a string`, { [key]: `${key} must be a string` })
  }
  if (max && value.length > max) {
    throw new NewsletterValidationError(`${key} may not be greater than ${max} characters`, {
      [key]: `${key} may not be greater than ${max} characters`,
    })
  }
  return value
}

export function requiredInteger(body: any, key: string, min?: number, max?: number): number {
  const value = Number(body?.[key])
  if (!Number.isInteger(value)) {
    throw new NewsletterValidationError(`${key} must be an integer`, { [key]: `${key} must be an integer` })
  }
  if (min != null && value < min) {
    throw new NewsletterValidationError(`${key} must be at least ${min}`, {
      [key]: `${key} must be at least ${min}`,
    })
  }
  if (max != null && value > max) {
    throw new NewsletterValidationError(`${key} must be at most ${max}`, {
      [key]: `${key} must be at most ${max}`,
    })
  }
  return value
}

export function optionalInteger(body: any, key: string): number | null {
  if (body?.[key] == null || body?.[key] === '') return null
  return requiredInteger(body, key)
}

export function requiredBoolean(body: any, key: string): boolean {
  const value = body?.[key]
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === '1' || value === 1) return true
  if (value === 'false' || value === '0' || value === 0) return false
  throw new NewsletterValidationError(`${key} must be a boolean`, { [key]: `${key} must be a boolean` })
}

export function assertEmail(
  value: string | null,
  key: string,
  required = false
): string | null {
  if (!value) {
    if (required) {
      throw new NewsletterValidationError(`${key} must be a valid email`, {
        [key]: `${key} must be a valid email`,
      })
    }
    return null
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 320) {
    throw new NewsletterValidationError(`${key} must be a valid email`, {
      [key]: `${key} must be a valid email`,
    })
  }
  return value
}

export function assertOneOf<T extends string>(value: unknown, key: string, allowed: T[]): T {
  if (!allowed.includes(value as T)) {
    throw new NewsletterValidationError(`${key} must be one of ${allowed.join(', ')}`, {
      [key]: `${key} must be one of ${allowed.join(', ')}`,
    })
  }
  return value as T
}

export function optionalDateAfterNow(body: any, key: string): Date | null {
  const value = body?.[key]
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime()) || date <= new Date()) {
    throw new NewsletterValidationError(`${key} must be a future date`, {
      [key]: `${key} must be a future date`,
    })
  }
  return date
}

export function assertArrayOrNull(
  value: unknown,
  key: string
): Record<string, unknown> | { rules: unknown[] } | null {
  if (value == null || value === '') return null
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return value as Record<string, unknown>
  }
  throw new NewsletterValidationError(`${key} must be an array`, { [key]: `${key} must be an array` })
}

export function abort422(message: string): never {
  throw new NewsletterValidationError(message)
}

export function decodeTrackedUrl(encoded: string): string {
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  const decoded = Buffer.from(padded, 'base64').toString('utf8')
  if (!decoded) {
    throw new NewsletterValidationError('Bad request')
  }
  let url: URL
  try {
    url = new URL(decoded)
  } catch {
    throw new NewsletterValidationError('Bad request')
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new NewsletterValidationError('Bad request')
  }
  return decoded
}

export function userIdFromAuth(user: any): number | string | null {
  return user?.id ?? null
}

export async function mailConfigured(): Promise<boolean> {
  try {
    const { default: mail } = await import('@adonisjs/mail/services/main')
    return typeof mail.send === 'function'
  } catch {
    return false
  }
}
