import type { AccessConfig } from '../../../src/support/access_features.js'
import type { SsoConfig } from '../../../src/support/sso.js'

/*
|--------------------------------------------------------------------------
| Access switches in tests
|--------------------------------------------------------------------------
|
| The access features (roles & permissions, two-factor, SSO) are install-level
| switches read from `config.access`. Specs flip them on the loaded config
| for the request they make; `undefined` removes the block again, leaving the
| defaults (all off).
|
*/

export function setAccess(access: AccessConfig | undefined) {
  const config = ((globalThis as any).__escalated_config ??= {})
  if (access === undefined) {
    delete config.access
  } else {
    config.access = { ...access }
  }
}

/** Sets `config.sso` (the SSO options); `undefined` removes it. */
export function setSso(sso: SsoConfig | undefined) {
  const config = ((globalThis as any).__escalated_config ??= {})
  if (sso === undefined) {
    delete config.sso
  } else {
    config.sso = { ...sso }
  }
}
