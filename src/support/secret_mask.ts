/*
|--------------------------------------------------------------------------
| Secret mask
|--------------------------------------------------------------------------
|
| The placeholder an admin settings page shows for a stored secret, after
| escalated-laravel's Support\SecretMask. The page learns only that a secret
| is set. Posting the placeholder back means "keep the stored value";
| anything else replaces it.
|
*/

export const SECRET_MASK = '********'

/** The mask for a stored secret, or '' when none is set. */
export function maskSecret(value: string | null | undefined): string {
  return value === null || value === undefined || value === '' ? '' : SECRET_MASK
}

/**
 * Whether a posted value is a mask rather than a new secret. Also accepts the
 * older "abc*****" form, so a settings tab opened before an upgrade does not
 * overwrite the secret with its placeholder.
 */
export function isMaskedSecret(value: unknown): boolean {
  return typeof value === 'string' && value !== '' && /^.{0,3}\*{3,}$/.test(value)
}
