/*
|--------------------------------------------------------------------------
| Widget CORS headers
|--------------------------------------------------------------------------
|
| The headers WidgetCors sends. An allowed site gets its own origin back,
| never `*` and never Access-Control-Allow-Credentials: an embedded widget
| works without cookies.
|
*/

export const WIDGET_CORS_ALLOW_METHODS = 'GET, POST, OPTIONS'
export const WIDGET_CORS_ALLOW_HEADERS = 'Accept, Authorization, Content-Type, X-Requested-With'
export const WIDGET_CORS_EXPOSE_HEADERS = 'Retry-After'
export const WIDGET_CORS_DEFAULT_MAX_AGE = 600

export function isPreflight(method: string, requestMethodHeader: string | null | undefined) {
  return method.toUpperCase() === 'OPTIONS' && !!requestMethodHeader
}

/** Headers for every actual response to an allowed site. */
export function corsResponseHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Expose-Headers': WIDGET_CORS_EXPOSE_HEADERS,
  }
}

/** Headers for a preflight answer; none when the origin is not allowed. */
export function preflightHeaders(origin: string | null, maxAge: number): Record<string, string> {
  if (origin === null) return {}

  return {
    ...corsResponseHeaders(origin),
    'Access-Control-Allow-Methods': WIDGET_CORS_ALLOW_METHODS,
    'Access-Control-Allow-Headers': WIDGET_CORS_ALLOW_HEADERS,
    'Access-Control-Max-Age': String(Math.max(0, Math.trunc(maxAge))),
  }
}

/** A Vary value that includes Origin, keeping what was there. */
export function mergeVary(existing: unknown): string {
  const values = (Array.isArray(existing) ? existing : [existing])
    .filter((value) => value !== undefined && value !== null)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '')

  if (!values.some((value) => value.toLowerCase() === 'origin' || value === '*')) {
    values.push('Origin')
  }

  return values.join(', ')
}
