import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The TOTP time step of the last code accepted for a user, so the same code
 * (or an older one) cannot be used again inside its validity window
 * (ADR 2026-10-29-configurable-access-features). Null until a code is used.
 */
export default class AddLastUsedStepToEscalatedTwoFactor extends BaseSchema {
  protected tableName = 'escalated_two_factor'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.bigInteger('last_used_step').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_used_step')
    })
  }
}
