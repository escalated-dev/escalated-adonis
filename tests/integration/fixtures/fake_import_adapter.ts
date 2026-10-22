import { ExtractResult, type ImportAdapter } from '../../../src/contracts/import_adapter.js'

/*
|--------------------------------------------------------------------------
| FakeImportAdapter
|--------------------------------------------------------------------------
|
| An import source for tests. It stands in for a plugin-provided adapter
| (Zendesk, Freshdesk, ...): core never talks to a third-party API itself, it
| only drives whatever the `import.adapters` filter hands it.
|
| The records are fixed: two contacts, one tag, three tickets served two to a
| page, and two replies. `onExtract` lets a test act between batches, for
| example to pause the job or to observe the import context.
|
*/

export const TOKEN = 'secret-token'
export const CREDENTIALS = { subdomain: 'acme', api_token: TOKEN }

export const CREDENTIAL_FIELDS = [
  { name: 'subdomain', label: 'Subdomain', type: 'text' as const, help: 'acme' },
  { name: 'api_token', label: 'API token', type: 'password' as const, help: '' },
]

export const TICKET_SOURCE_FIELDS = [
  { name: 'subject', label: 'Subject', escalated_options: ['title', 'description'] },
  { name: 'state', label: 'State', escalated_options: ['status'] },
]

const RECORDS: Record<string, Record<string, any>[]> = {
  contacts: [
    { source_id: 'c1', email: 'ada@customer.test', name: 'Ada Customer' },
    { source_id: 'c2', email: 'bob@customer.test', name: 'Bob Customer' },
  ],
  tags: [{ source_id: 't1', name: 'Billing' }],
  tickets: [
    {
      source_id: 'k1',
      title: 'Refund please',
      description: 'Charged twice.',
      status: 'open',
      priority: 'high',
      requester_source_id: 'c1',
      tag_source_ids: ['t1'],
      created_at: '2024-01-02T03:04:05Z',
    },
    {
      source_id: 'k2',
      title: 'Login broken',
      status: 'resolved',
      priority: 'urgent',
      requester_source_id: 'c2',
    },
    { source_id: 'k3', title: 'Feature idea', status: 'not-a-status', requester_source_id: 'c1' },
  ],
  replies: [
    { source_id: 'r1', ticket_source_id: 'k1', body: 'Looking into it', author_source_id: 'c1' },
    { source_id: 'r2', ticket_source_id: 'k2', body: 'Internal note', is_internal_note: true },
  ],
}

const PAGE_SIZE = 2

export class FakeImportAdapter implements ImportAdapter {
  onExtract: ((entityType: string, cursor: string | null) => unknown) | null = null
  extractCalls: Array<[string, string | null]> = []
  sourceFieldCredentials: Record<string, string> | null = null

  name() {
    return 'fakedesk'
  }

  displayName() {
    return 'FakeDesk'
  }

  credentialFields() {
    return CREDENTIAL_FIELDS
  }

  async testConnection(credentials: Record<string, string>) {
    if (credentials.subdomain === 'down') throw new Error('FakeDesk is unreachable')
    return credentials.api_token === TOKEN
  }

  entityTypes() {
    return Object.keys(RECORDS)
  }

  defaultFieldMappings(entityType: string): Record<string, string> {
    return entityType === 'tickets' ? { subject: 'title', state: 'status' } : {}
  }

  async availableSourceFields(entityType: string, credentials: Record<string, string>) {
    this.sourceFieldCredentials = credentials
    return entityType === 'tickets' ? TICKET_SOURCE_FIELDS : []
  }

  async extract(entityType: string, credentials: Record<string, string>, cursor: string | null) {
    if (credentials.api_token !== TOKEN) throw new Error('bad credentials')

    this.extractCalls.push([entityType, cursor])
    if (this.onExtract) await this.onExtract(entityType, cursor)

    const records = RECORDS[entityType]
    const offset = Number(cursor ?? 0)
    const next = offset + PAGE_SIZE

    return new ExtractResult(
      records.slice(offset, next),
      next < records.length ? String(next) : null,
      records.length
    )
  }
}
