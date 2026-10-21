import { type DateTime } from 'luxon'
import { column, computed } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'

export default class Attachment extends EscalatedBaseModel {
  static table = 'escalated_attachments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare attachableType: string

  @column()
  declare attachableId: number

  @column()
  declare filename: string

  @column()
  declare originalFilename: string

  @column()
  declare mimeType: string

  @column()
  declare size: number

  @column({ serializeAs: null })
  declare disk: string

  @column({ serializeAs: null })
  declare path: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  /**
   * The short-lived download link, serialized as `url`. Controllers set it
   * with `signAttachments()` (support/attachment_access) before rendering;
   * it is null otherwise. Disk names and storage paths are never a link:
   * attachments are private and only the download route serves them.
   */
  @computed()
  get url(): string | null {
    return this.$extras.downloadUrl ?? null
  }

  // ---- Helpers ----

  sizeForHumans(): string {
    let bytes = this.size
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024
      i++
    }
    return `${Math.round(bytes * 100) / 100} ${units[i]}`
  }
}
