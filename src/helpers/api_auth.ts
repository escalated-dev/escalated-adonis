/**
 * Pure helpers for the general JSON API auth endpoints, kept free of Lucid/
 * HttpContext/config imports so they can be unit-tested in isolation (the
 * plain `node --test` runner does not resolve the `.js` import chain).
 */

export type AuthCallback = (
  arg: any
) => Promise<Record<string, any> | null> | Record<string, any> | null

export interface AuthResult {
  status: number
  body: Record<string, any>
}

/**
 * Invoke a host auth callback and map the outcome to a status + JSON body:
 * missing callback -> 501, falsy result -> 401, otherwise 200 with {data}.
 */
export async function runAuthCallback(
  callback: AuthCallback | undefined,
  arg: any
): Promise<AuthResult> {
  if (!callback) {
    return { status: 501, body: { error: 'Authentication is not configured' } }
  }

  const result = await callback(arg ?? {})
  if (!result) {
    return { status: 401, body: { error: 'Unauthorized' } }
  }

  return { status: 200, body: { data: result } }
}

/** Extract the bearer token from an Authorization header value. */
export function bearerToken(header: string | undefined): string {
  const value = header ?? ''
  return value.startsWith('Bearer ') ? value.slice(7).trim() : value
}
