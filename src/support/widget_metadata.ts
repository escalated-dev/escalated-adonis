/*
|--------------------------------------------------------------------------
| Widget metadata
|--------------------------------------------------------------------------
|
| Host parameters an embedding page sends with a widget ticket or chat (order
| number, plan, account id, the page URL, ...). They come from the visitor's
| browser, so only a flat map of short scalar values is kept, and
| `embedded_on` is always set by the server from the request's Origin.
|
*/

export const WIDGET_METADATA_MAX_ENTRIES = 25
export const WIDGET_METADATA_MAX_KEYS = 50
export const WIDGET_METADATA_MAX_VALUE_LENGTH = 500

const KEY = /^[A-Za-z0-9_.:-]{1,64}$/

export type WidgetMetadata = Record<string, string | number | boolean>

export type WidgetMetadataResult =
  { valid: true; metadata: WidgetMetadata | null } | { valid: false; error: string }

/**
 * Sanitises the `metadata` a widget request sent. `embeddedOn` is the allowed
 * cross-origin Origin of the request, or null.
 *
 * Invalid only when metadata is present and is not an object, or has more
 * than 50 keys; otherwise unusable entries are dropped.
 */
export function sanitizeWidgetMetadata(
  input: unknown,
  embeddedOn: string | null
): WidgetMetadataResult {
  if (input !== undefined && input !== null) {
    if (typeof input !== 'object' || Array.isArray(input)) {
      return { valid: false, error: 'metadata must be an object' }
    }
    if (Object.keys(input).length > WIDGET_METADATA_MAX_KEYS) {
      return {
        valid: false,
        error: `metadata may not have more than ${WIDGET_METADATA_MAX_KEYS} keys`,
      }
    }
  }

  const clean: WidgetMetadata = {}
  let count = 0
  for (const [key, raw] of Object.entries((input as Record<string, unknown>) ?? {})) {
    if (count >= WIDGET_METADATA_MAX_ENTRIES) break
    if (!KEY.test(key)) continue

    let value: string | number | boolean
    if (typeof raw === 'string') {
      value = Array.from(raw.trim()).slice(0, WIDGET_METADATA_MAX_VALUE_LENGTH).join('')
    } else if ((typeof raw === 'number' && Number.isFinite(raw)) || typeof raw === 'boolean') {
      value = raw
    } else {
      continue
    }

    clean[key] = value
    count++
  }

  if ('page_url' in clean && !isWebUrl(clean.page_url)) delete clean.page_url

  // Recorded from the request's Origin, so the page cannot claim another site.
  delete clean.embedded_on
  if (embeddedOn) clean.embedded_on = embeddedOn

  return { valid: true, metadata: Object.keys(clean).length === 0 ? null : clean }
}

function isWebUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  } catch {
    return false
  }
}
