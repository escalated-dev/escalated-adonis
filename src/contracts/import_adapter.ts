/*
|--------------------------------------------------------------------------
| ImportAdapter interface + ExtractResult value object
|--------------------------------------------------------------------------
|
| Third-party import plugins implement ImportAdapter to teach the framework
| how to authenticate against, enumerate, and page through records from a
| specific external platform (Zendesk, Freshdesk, Intercom, Help Scout…).
|
| Adapters are registered via the `import.adapters` filter hook:
|
|   escalated_addFilter('import.adapters', (adapters) => {
|     adapters.push(new MyAdapter())
|     return adapters
|   })
|
*/

// --------------------------------------------------------------------------
// ExtractResult
// --------------------------------------------------------------------------

/**
 * Value object returned by `ImportAdapter.extract()`.
 *
 * `records`    — normalized records as plain objects.
 * `cursor`     — opaque pagination cursor; `null` signals the last page.
 * `totalCount` — estimated total records from the API, if available.
 */
export class ExtractResult {
  constructor(
    /** Normalized records as plain objects */
    public readonly records: Record<string, any>[],
    /** Next-page cursor; null when all pages have been fetched */
    public readonly cursor: string | null,
    /** Estimated total record count from the API, if available */
    public readonly totalCount: number | null = null
  ) {}

  /**
   * True when no more pages remain.
   */
  isExhausted(): boolean {
    return this.cursor === null
  }
}

// --------------------------------------------------------------------------
// CredentialField
// --------------------------------------------------------------------------

export interface CredentialField {
  /** Internal field name (e.g. "api_token") */
  name: string
  /** Human-readable label shown in the UI */
  label: string
  /** Input type */
  type: 'text' | 'password' | 'url' | 'email'
  /** Optional help text */
  help?: string
  /** Whether the field is required */
  required?: boolean
}

// --------------------------------------------------------------------------
// ImportAdapter interface
// --------------------------------------------------------------------------

export interface ImportAdapter {
  /**
   * Unique slug used to identify this adapter (e.g. "zendesk").
   * This is stored on ImportJob.platform.
   */
  name(): string

  /**
   * Human-readable display name shown in the admin UI (e.g. "Zendesk").
   */
  displayName(): string

  /**
   * Credential fields required to authenticate against the platform.
   * Rendered as a form in the admin import wizard.
   */
  credentialFields(): CredentialField[]

  /**
   * Validate the provided credentials by making a lightweight test API call.
   * Returns true if authentication succeeds.
   */
  testConnection(credentials: Record<string, string>): Promise<boolean>

  /**
   * Ordered list of entity types this adapter can import.
   * Order matters — dependencies must come before dependents
   * (e.g. agents and contacts before tickets; tickets before replies).
   *
   * Well-known types: 'agents' | 'tags' | 'custom_fields' | 'contacts' |
   *   'departments' | 'tickets' | 'replies' | 'attachments' | 'satisfaction_ratings'
   */
  entityTypes(): string[]

  /**
   * Default field mappings for a given entity type.
   * Returned as a plain object: { sourceField: escalatedField }.
   */
  defaultFieldMappings(entityType: string): Record<string, string>

  /**
   * Fetch the list of fields available on the source platform for a given
   * entity type. Used to populate the field-mapping UI.
   */
  availableSourceFields(
    entityType: string,
    credentials: Record<string, string>
  ): Promise<string[]>

  /**
   * Extract a batch of normalized records from the platform.
   * Pass `cursor = null` to start from the beginning.
   * Returns an `ExtractResult`; when `result.cursor === null` the import
   * for this entity type is complete.
   */
  extract(
    entityType: string,
    credentials: Record<string, string>,
    cursor: string | null
  ): Promise<ExtractResult>

  /**
   * Optional: receive the ImportJob ID so the adapter can resolve
   * cross-entity references via ImportSourceMap.
   */
  setJobId?(jobId: string): void
}
