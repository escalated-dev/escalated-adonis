/*
|--------------------------------------------------------------------------
| ImportJob Model
|--------------------------------------------------------------------------
|
| Tracks a data import operation from an external platform.
| Uses a state machine to manage transitions between import lifecycle phases.
| Credentials are encrypted at rest and purged after successful import.
|
*/

import { type DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import ImportSourceMap from './import_source_map.js'

// --------------------------------------------------------------------------
// Encryption helpers (AES-256-GCM, key derived from APP_KEY)
// --------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const appKey = process.env.APP_KEY ?? 'escalated-fallback-key-not-secure'
  return createHash('sha256').update(appKey).digest()
}

function encryptJson(value: any): string | null {
  if (value === null || value === undefined) return null
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = JSON.stringify(value)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, encrypted])
  return payload.toString('base64')
}

function decryptJson(value: string | null): any {
  if (!value) return null
  try {
    const key = getEncryptionKey()
    const payload = Buffer.from(value, 'base64')
    const iv = payload.subarray(0, 12)
    const authTag = payload.subarray(12, 28)
    const encrypted = payload.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return JSON.parse(decrypted.toString('utf8'))
  } catch {
    return null
  }
}

// --------------------------------------------------------------------------
// Status types
// --------------------------------------------------------------------------

export type ImportJobStatus =
  | 'pending'
  | 'authenticating'
  | 'mapping'
  | 'importing'
  | 'paused'
  | 'completed'
  | 'failed'

export interface EntityProgress {
  total: number
  processed: number
  skipped: number
  failed: number
  cursor: string | null
}

export interface ErrorLogEntry {
  entity_type: string
  source_id: string
  error: string
  timestamp: string
}

// --------------------------------------------------------------------------
// Model
// --------------------------------------------------------------------------

export default class ImportJob extends BaseModel {
  static table = 'escalated_import_jobs'

  static readonly VALID_TRANSITIONS: Record<ImportJobStatus, ImportJobStatus[]> = {
    pending: ['authenticating'],
    authenticating: ['mapping', 'failed'],
    mapping: ['importing', 'failed'],
    importing: ['paused', 'completed', 'failed'],
    paused: ['importing', 'failed'],
    completed: [],
    failed: ['mapping'],
  }

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare platform: string

  @column()
  declare status: ImportJobStatus

  @column({
    prepare: (value: any) => encryptJson(value),
    consume: (value: any) => decryptJson(value),
  })
  declare credentials: Record<string, string> | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare fieldMappings: Record<string, any> | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare progress: Record<string, EntityProgress> | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) =>
      value ? (typeof value === 'string' ? JSON.parse(value) : value) : null,
  })
  declare errorLog: ErrorLogEntry[] | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare completedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Relationships ----

  @hasMany(() => ImportSourceMap, { foreignKey: 'importJobId' })
  declare sourceMaps: HasMany<typeof ImportSourceMap>

  // ---- State machine ----

  /**
   * Transition to a new status. Throws if the transition is not valid.
   */
  async transitionTo(newStatus: ImportJobStatus): Promise<void> {
    const currentStatus = this.status ?? 'pending'
    const allowed = ImportJob.VALID_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition import job from '${currentStatus}' to '${newStatus}'.`)
    }

    this.status = newStatus
    await this.save()
  }

  // ---- Progress helpers ----

  /**
   * Update progress counters for a specific entity type.
   */
  async updateEntityProgress(
    entityType: string,
    options: {
      processed?: number
      total?: number
      skipped?: number
      failed?: number
      cursor?: string | null
    }
  ): Promise<void> {
    const progress = this.progress ?? {}
    const current: EntityProgress = progress[entityType] ?? {
      total: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      cursor: null,
    }

    if (options.processed !== undefined) current.processed = options.processed
    if (options.total !== undefined) current.total = options.total
    if (options.skipped !== undefined) current.skipped = options.skipped
    if (options.failed !== undefined) current.failed = options.failed
    if (options.cursor !== undefined) current.cursor = options.cursor

    progress[entityType] = current
    this.progress = progress
    await this.save()
  }

  /**
   * Get the current cursor for an entity type.
   */
  getEntityCursor(entityType: string): string | null {
    return this.progress?.[entityType]?.cursor ?? null
  }

  /**
   * Append an error entry to the error log (capped at 10,000 entries).
   */
  async appendError(entityType: string, sourceId: string, error: string): Promise<void> {
    const log = this.errorLog ?? []

    if (log.length < 10000) {
      log.push({
        entity_type: entityType,
        source_id: sourceId,
        error,
        timestamp: new Date().toISOString(),
      })
      this.errorLog = log
      await this.save()
    }
  }

  /**
   * Purge credentials after a successful import.
   */
  async purgeCredentials(): Promise<void> {
    this.credentials = null
    await this.save()
  }

  /**
   * Whether the job can be resumed.
   */
  isResumable(): boolean {
    return this.status === 'paused' || this.status === 'failed'
  }
}
