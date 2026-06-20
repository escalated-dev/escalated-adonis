import Contact from '../../models/contact.js'
import type NewsletterList from '../../models/newsletter/newsletter_list.js'
import NewsletterListMember from '../../models/newsletter/newsletter_list_member.js'

type FilterRule = { field: string; op: string; value: unknown }
type Filter = { rules?: FilterRule[] }

export default class ContactSegmentResolver {
  /** Columns a dynamic-list rule may filter on (snake_case + model camelCase). */
  private static readonly ALLOWED_FIELDS = new Set([
    'id',
    'email',
    'name',
    'user_id',
    'userId',
    'metadata',
    'created_at',
    'createdAt',
    'updated_at',
    'updatedAt',
    'marketing_opt_out_at',
    'marketingOptOutAt',
  ])

  private static readonly ALLOWED_OPS = new Set(['=', '!=', '<>', '<', '<=', '>', '>=', 'like'])

  /** Whether a dynamic-list filter rule passes the field/op allowlist (for tests and callers). */
  static isAllowedFilterRule(field: string | undefined, op: string): boolean {
    if (!field) return false
    const normalizedOp = (op || '=').toLowerCase()
    if (!ContactSegmentResolver.ALLOWED_OPS.has(normalizedOp)) return false
    if (field.startsWith('metadata.')) {
      const key = field.slice('metadata.'.length)
      return /^[a-zA-Z0-9_]+$/.test(key)
    }
    return ContactSegmentResolver.ALLOWED_FIELDS.has(field)
  }

  async resolve(list: NewsletterList): Promise<number[]> {
    if (list.kind === 'static') {
      const rows = await NewsletterListMember.query().where('listId', list.id).select('contact_id')
      return rows.map((r: NewsletterListMember) => r.contactId)
    }
    const rows = await this.applyFilter(list.filterJson ?? { rules: [] })
    return rows.map((r: Contact) => r.id)
  }

  async resolveSendable(list: NewsletterList): Promise<number[]> {
    let q = Contact.query().whereNull('marketingOptOutAt')
    if (list.kind === 'static') {
      const memberRows = await NewsletterListMember.query()
        .where('listId', list.id)
        .select('contact_id')
      const ids = memberRows.map((r: NewsletterListMember) => r.contactId)
      if (ids.length === 0) return []
      q = q.whereIn('id', ids)
    } else {
      q = this.appendFilter(q, list.filterJson ?? { rules: [] })
    }
    const rows = await q.select('id')
    return rows.map((r: Contact) => r.id)
  }

  async countMatches(filter: Filter): Promise<number> {
    const q = this.appendFilter(Contact.query(), filter)
    const result = await q.count('* as total')
    const raw = (result[0] as any).$extras?.total ?? (result[0] as any).total
    return Number(raw)
  }

  private async applyFilter(filter: Filter) {
    return await this.appendFilter(Contact.query(), filter).select('id')
  }

  private appendFilter(q: any, filter: Filter) {
    for (const rule of filter.rules ?? []) {
      const field = rule.field
      const op = (rule.op || '=').toLowerCase()
      const value = rule.value
      if (!ContactSegmentResolver.isAllowedFilterRule(field, op)) continue
      if (field!.startsWith('metadata.')) {
        const key = field!.slice('metadata.'.length)
        q = q.whereRaw('metadata LIKE ?', [`%"${key}":${JSON.stringify(value)}%`])
        continue
      }
      q = q.where(field!, op, value as any)
    }
    return q
  }
}
