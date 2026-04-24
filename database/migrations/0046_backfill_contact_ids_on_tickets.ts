import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Backfills ticket.contact_id from inline guest_email. Idempotent via
 * the unique email index on escalated_contacts.
 */
export default class BackfillContactIdsOnTickets extends BaseSchema {
  async up() {
    const rows = await this.db
      .from('escalated_tickets')
      .whereNotNull('guest_email')
      .whereNull('contact_id')
      .select('id', 'guest_email', 'guest_name')

    const seen = new Map<string, number>()

    for (const row of rows) {
      const email = (row.guest_email ?? '').trim().toLowerCase()
      if (!email) continue

      let contactId = seen.get(email)
      if (!contactId) {
        const existing = await this.db
          .from('escalated_contacts')
          .where('email', email)
          .select('id')
          .first()
        if (existing) {
          contactId = existing.id
        } else {
          const now = new Date()
          const [inserted] = await this.db
            .table('escalated_contacts')
            .returning('id')
            .insert({
              email,
              name: row.guest_name || null,
              user_id: null,
              metadata: JSON.stringify({}),
              created_at: now,
              updated_at: now,
            })
          contactId = typeof inserted === 'object' ? inserted.id : inserted
        }
        seen.set(email, contactId as number)
      }

      await this.db
        .from('escalated_tickets')
        .where('id', row.id)
        .update({ contact_id: contactId })
    }
  }

  async down() {
    await this.db.from('escalated_tickets').update({ contact_id: null })
  }
}
