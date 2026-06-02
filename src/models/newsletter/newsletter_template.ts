import { type DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class NewsletterTemplate extends BaseModel {
  static table = 'escalated_newsletter_templates'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare theme: string

  @column({ columnName: 'subject_template' })
  declare subjectTemplate: string | null

  @column({ columnName: 'body_markdown' })
  declare bodyMarkdown: string

  @column({
    columnName: 'merge_fields_schema',
    prepare: (value: unknown) => (value === null ? null : JSON.stringify(value)),
    consume: (value: string | null) => (value === null ? null : JSON.parse(value)),
  })
  declare mergeFieldsSchema: unknown | null

  @column({ columnName: 'created_by' })
  declare createdBy: number | null

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
