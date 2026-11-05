import { type DateTime } from 'luxon'
import { column } from '@adonisjs/lucid/orm'
import EscalatedBaseModel from './base_model.js'

/**
 * When a customer (a requester, or a guest's contact) was last seen by the
 * customer portal or the widget. Only ever shown to staff.
 */
export default class CustomerPresence extends EscalatedBaseModel {
  static table = 'escalated_customer_presence'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare subjectType: string

  @column()
  declare subjectId: string

  @column.dateTime()
  declare lastSeenAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
