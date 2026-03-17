/*
|--------------------------------------------------------------------------
| ImportSourceMap Model
|--------------------------------------------------------------------------
|
| Maps source platform IDs (e.g. Zendesk ticket #1234) to the corresponding
| Escalated-internal IDs created during an import. Used for resumability
| (skip already-imported records) and cross-entity reference resolution
| (e.g. look up the Escalated ticket ID from a Zendesk ticket ID when
| importing replies).
|
| No updated_at column — these rows are write-once.
|
*/

import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ImportJob from './import_job.js'

export default class ImportSourceMap extends BaseModel {
  static table = 'escalated_import_source_maps'

  static selfAssignPrimaryKey = false

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare importJobId: string

  @column()
  declare entityType: string

  @column()
  declare sourceId: string

  @column()
  declare escalatedId: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // ---- Relationships ----

  @belongsTo(() => ImportJob, { foreignKey: 'importJobId' })
  declare importJob: BelongsTo<typeof ImportJob>

  // ---- Static helpers ----

  /**
   * Look up the Escalated-internal ID for a previously imported record.
   * Returns null if the record has not been imported yet.
   */
  static async resolve(
    jobId: string,
    entityType: string,
    sourceId: string
  ): Promise<string | null> {
    const row = await ImportSourceMap.query()
      .where('import_job_id', jobId)
      .where('entity_type', entityType)
      .where('source_id', sourceId)
      .select('escalated_id')
      .first()

    return row?.escalatedId ?? null
  }

  /**
   * Check if a record from the source platform has already been imported.
   */
  static async hasBeenImported(
    jobId: string,
    entityType: string,
    sourceId: string
  ): Promise<boolean> {
    const escalatedId = await ImportSourceMap.resolve(jobId, entityType, sourceId)
    return escalatedId !== null
  }
}
