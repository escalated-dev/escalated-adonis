import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Attachment extends BaseModel {
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

  @column()
  declare disk: string

  @column()
  declare path: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Helpers ----

  async url(): Promise<string> {
    const { default: drive } = await import('@adonisjs/drive/services/main')
    return drive.use(this.disk as any).getUrl(this.path)
  }

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
