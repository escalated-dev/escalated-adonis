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
 * The Lucid connection Escalated's own tables live on, or undefined for the
 * host application's default connection.
 *
 * Undefined is the historical behaviour and stays the default, so a host that
 * never sets this sees no change. Hosts that partition their database name a
 * connection from `config/database.ts` instead.
 *
 * An empty string is treated as unset -- an empty connection name is not a
 * connection anyone meant to configure.
 *
 * This deliberately does not move the host's user table. Escalated stores host
 * user ids as plain unconstrained columns precisely so the two can live on
 * different connections with no foreign key to span them.
 */
export function connectionName(): string | undefined {
  const configured = getConfig().connection

  return typeof configured === 'string' && configured !== '' ? configured : undefined
}

/**
 * A query client for Escalated's own tables.
 *
 * Use this wherever the query builder is reached for directly, rather than the
 * bare `db` service, so raw queries follow the package's tables instead of the
 * host's default connection.
 */
export async function escalatedDb() {
  const { default: db } = await import('@adonisjs/lucid/services/db')

  return db.connection(connectionName())
}

/**
 * Get the prefixed table name.
 */
export function table(name: string): string {
  return `${tablePrefix()}${name}`
}
