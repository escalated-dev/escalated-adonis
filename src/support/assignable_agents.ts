import { getConfig } from '../helpers/config.js'
import { agentCanAccessTicket } from './ticket_access.js'
import { resolveUserModel } from './user_model.js'

export type StaffUser = { id: number; name: string; email: string }

/**
 * The host's agents and admins (`authorization.isAgent` / `isAdmin`), in the
 * user model's order. Empty when the user model cannot be listed.
 */
export async function staffUsers(): Promise<StaffUser[]> {
  const authorization = getConfig()?.authorization
  try {
    const UserModel = await resolveUserModel()
    const users = await UserModel.all()

    const staff: StaffUser[] = []
    for (const user of users) {
      const isAgent = authorization?.isAgent ? await authorization.isAgent(user) : false
      const isAdmin = authorization?.isAdmin ? await authorization.isAdmin(user) : false
      if (isAgent || isAdmin) {
        staff.push({ id: user.id, name: user.name ?? user.fullName ?? '', email: user.email ?? '' })
      }
    }
    return staff
  } catch {
    return []
  }
}

/** The staff who may see the ticket under the configured visibility. */
export async function staffWhoCanAccess(
  ticket: { id: number },
  candidates?: StaffUser[]
): Promise<StaffUser[]> {
  const staff = candidates ?? (await staffUsers())
  const eligibility = await Promise.all(staff.map((user) => agentCanAccessTicket(user.id, ticket)))
  return staff.filter((_user, index) => eligibility[index])
}

/**
 * The staff a ticket can be assigned to, as the agent ticket page's `agents`
 * prop: `[{ id, name }]` of agents and admins who can see it.
 */
export async function assignableAgents(ticket: {
  id: number
}): Promise<Array<{ id: number; name: string }>> {
  const staff = await staffWhoCanAccess(ticket)
  return staff.map(({ id, name }) => ({ id, name }))
}
