import type { EscalatedConfig } from '../types.js'

/**
 * Get the escalated config from the global store.
 */
export function getConfig(): EscalatedConfig {
  return (globalThis as any).__escalated_config ?? {}
}

/**
 * Get the table prefix.
 */
export function tablePrefix(): string {
  return getConfig().tablePrefix ?? 'escalated_'
}

/**
 * Get the prefixed table name.
 */
export function table(name: string): string {
  return `${tablePrefix()}${name}`
}
