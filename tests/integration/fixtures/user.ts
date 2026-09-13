/**
 * Plays the host application's user model (`config.userModel`) in integration
 * tests. Escalated only needs `find()` from it.
 *
 * The users are instances of this class, as a host's users are instances of
 * its model: Escalated records `user.constructor.name` as the type in
 * polymorphic columns such as a ticket's requester, and compares it when it
 * checks who owns a ticket.
 */

export type TestUser = { id: number; role: 'admin' | 'agent' | 'customer' }

export default class User implements TestUser {
  declare id: number
  declare role: TestUser['role']

  constructor(id: number, role: TestUser['role']) {
    this.id = id
    this.role = role
  }

  static async find(id: number | string): Promise<User | null> {
    return Object.values(TEST_USERS).find((user) => String(user.id) === String(id)) ?? null
  }
}

export const TEST_USERS = {
  admin: new User(1, 'admin'),
  agent: new User(2, 'agent'),
  customer: new User(3, 'customer'),
  otherCustomer: new User(4, 'customer'),
}
