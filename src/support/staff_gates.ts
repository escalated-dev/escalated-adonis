/*
|--------------------------------------------------------------------------
| Staff gates
|--------------------------------------------------------------------------
|
| `authorization.isAgent` and `authorization.isAdmin` in config/escalated.ts
| decide who is staff. An install that leaves them out has no staff at all:
| every agent and admin route answers 403. These helpers call a gate only
| when it is a function (a missing one is "no"), and name the missing
| settings so the 403 and `node ace escalated:doctor` say what to configure.
|
*/

import { getConfig } from '../helpers/config.js'

export type StaffGate = 'isAgent' | 'isAdmin'

const GATES: readonly StaffGate[] = ['isAgent', 'isAdmin']

/** The gates config/escalated.ts does not define as functions. */
export function missingStaffGates(): StaffGate[] {
  const authorization = (getConfig() as any).authorization
  return GATES.filter((gate) => typeof authorization?.[gate] !== 'function')
}

/** Explains what to add when no staff gate is configured. */
export function missingStaffGatesMessage(missing: StaffGate[] = missingStaffGates()): string {
  const names = missing.map((gate) => `authorization.${gate}`).join(' and ')
  return (
    `Escalated: ${names} ${missing.length === 1 ? 'is' : 'are'} not configured in ` +
    'config/escalated.ts, so no user is an Escalated agent or admin. Add callbacks such as ' +
    '`authorization: { isAgent: (user) => user.isAgent, isAdmin: (user) => user.isAdmin }`, then ' +
    'run `node ace escalated:doctor`.'
  )
}

/** Calls a gate; a gate that is not configured answers false. */
export async function passesStaffGate(gate: StaffGate, user: unknown): Promise<boolean> {
  if (!user) return false
  const callback = (getConfig() as any).authorization?.[gate]
  if (typeof callback !== 'function') return false
  return Boolean(await callback(user))
}
