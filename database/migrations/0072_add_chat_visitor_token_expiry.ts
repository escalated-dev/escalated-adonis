import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Widget chat tokens expire, as in escalated-laravel (docs/guest-access.md).
 * `visitor_token` now holds the token's SHA-256 and `visitor_token_expires_at`
 * when it stops working. Chats already in progress keep their plain token and a
 * null expiry; the next request with that token stores its hash and gives it a
 * full lifetime, so nobody is cut off by the upgrade.
 */
export default class AddChatVisitorTokenExpiry extends BaseSchema {
  protected tableName = 'escalated_chat_sessions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('visitor_token_expires_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('visitor_token_expires_at')
    })
  }
}
