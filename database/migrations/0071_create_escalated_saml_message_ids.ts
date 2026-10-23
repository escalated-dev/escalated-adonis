import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * SAML message IDs SsoService keeps for a short time (docs/sso.md): the
 * AuthnRequest IDs it issued (`kind = 'request'`, removed when a response
 * answers one) and the assertion IDs it has accepted (`kind = 'assertion'`,
 * kept until the assertion expires so it cannot be replayed). `expires_at` is
 * a Unix timestamp in seconds, so it compares the same way on every database.
 */
export default class CreateEscalatedSamlMessageIds extends BaseSchema {
  protected tableName = 'escalated_saml_message_ids'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('kind', 16).notNullable()
      table.string('message_id', 191).notNullable()
      table.bigInteger('expires_at').notNullable()
      table.unique(['kind', 'message_id'], {
        indexName: 'escalated_saml_message_ids_kind_message_unique',
      })
      table.index(['expires_at'], 'escalated_saml_message_ids_expires_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
