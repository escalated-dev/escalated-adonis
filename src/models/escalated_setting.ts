import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class EscalatedSetting extends BaseModel {
  static table = 'escalated_settings'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare key: string

  @column()
  declare value: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // ---- Static Helpers ----

  /**
   * Get a setting value by key.
   */
  static async get(key: string, defaultValue: string | null = null): Promise<string | null> {
    const setting = await EscalatedSetting.query().where('key', key).first()
    return setting ? setting.value : defaultValue
  }

  /**
   * Set a setting value by key.
   */
  static async set(key: string, value: string): Promise<void> {
    await EscalatedSetting.updateOrCreate({ key }, { value })
  }

  /**
   * Get a boolean setting value.
   */
  static async getBool(key: string, defaultValue: boolean = false): Promise<boolean> {
    const value = await EscalatedSetting.get(key)
    if (value === null) return defaultValue
    return value === '1' || value === 'true' || value === 'yes'
  }

  /**
   * Get an integer setting value.
   */
  static async getInt(key: string, defaultValue: number = 0): Promise<number> {
    const value = await EscalatedSetting.get(key)
    return value !== null ? parseInt(value, 10) : defaultValue
  }

  /**
   * Check if guest tickets are enabled.
   */
  static async guestTicketsEnabled(): Promise<boolean> {
    return EscalatedSetting.getBool('guest_tickets_enabled', true)
  }
}
