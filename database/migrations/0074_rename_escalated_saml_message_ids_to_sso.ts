import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The single-use message ID store now also holds JWT `jti`s (`kind = 'jwt'`)
 * besides SAML AuthnRequest IDs (`request`) and assertion IDs (`assertion`),
 * so it takes the name the ADR gives it (2026-10-29-configurable-access-features):
 * `escalated_sso_message_ids`. Columns, keys and rows are unchanged.
 */
export default class RenameEscalatedSamlMessageIdsToSso extends BaseSchema {
  async up() {
    this.schema.renameTable('escalated_saml_message_ids', 'escalated_sso_message_ids')
  }

  async down() {
    this.schema.renameTable('escalated_sso_message_ids', 'escalated_saml_message_ids')
  }
}
