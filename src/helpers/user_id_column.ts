import type { Knex } from 'knex'

export type UserKeyType = 'int' | 'bigint' | 'uuid' | 'string'

/** Host user key type from env. Default 'int' (existing behavior). */
export function userKeyType(): UserKeyType {
  const raw = (process.env.ESCALATED_USER_KEY_TYPE ?? 'int').trim().toLowerCase()
  if (raw === 'bigint') return 'bigint'
  if (raw === 'uuid') return 'uuid'
  if (raw === 'string' || raw === 'varchar') return 'string'
  return 'int'
}

/**
 * Add a host-user-id column to a Lucid/Knex migration table, typed to match the
 * host user key. uuid/string -> varchar(255) (holds a UUID or stringified int).
 * Returns the ColumnBuilder so callers can chain .nullable()/.index()/.unique().
 */
export function userIdColumn(table: Knex.CreateTableBuilder, name: string): Knex.ColumnBuilder {
  switch (userKeyType()) {
    case 'bigint':
      return table.bigInteger(name).unsigned()
    case 'uuid':
    case 'string':
      return table.string(name, 255)
    default:
      return table.integer(name).unsigned()
  }
}

/** TS type for a host user id (number | string). */
export type UserId = number | string
