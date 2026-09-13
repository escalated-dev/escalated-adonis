/**
 * Plays the host application's user model (`config.userModel`) in integration
 * tests. Escalated only needs `find()` from it.
 */

export type TestUser = { id: number; role: 'admin' | 'agent' | 'customer' }

export const TEST_USERS = {
  admin: { id: 1, role: 'admin' },
  agent: { id: 2, role: 'agent' },
  customer: { id: 3, role: 'customer' },
} satisfies Record<string, TestUser>

export default class User {
  static async find(id: number | string): Promise<TestUser | null> {
    return Object.values(TEST_USERS).find((user) => String(user.id) === String(id)) ?? null
  }
}
